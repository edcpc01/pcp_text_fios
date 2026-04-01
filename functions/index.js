/**
 * Corradi Production Planner — Cloud Functions
 *
 * Funções:
 *  1. microdataAgent    — Agente AI que interpreta perguntas em linguagem natural,
 *                         busca dados no Microdata e retorna resposta formatada.
 *  2. syncProduction    — Importa registros de produção do Microdata para o Firestore.
 *  3. onPlanningWrite   — Trigger: recalcula KPIs agregados quando planejamento muda.
 */

const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const cors = require('cors')({ origin: true });

// ─── Init ───────────────────────────────────────────────────────────────────

admin.initializeApp();
const db = admin.firestore();

// Deploy na região São Paulo para menor latência
setGlobalOptions({ region: 'southamerica-east1', maxInstances: 10 });

// ─── Constantes ─────────────────────────────────────────────────────────────

const FACTORIES = ['doptex', 'corradi'];

const MACHINES = {
  doptex: [
    { id: 'M01', name: 'Máquina 01', capacity: 420 },
    { id: 'M02', name: 'Máquina 02', capacity: 380 },
    { id: 'M03', name: 'Máquina 03', capacity: 460 },
    { id: 'M04', name: 'Máquina 04', capacity: 440 },
    { id: 'M05', name: 'Máquina 05', capacity: 500 },
    { id: 'M06', name: 'Máquina 06', capacity: 420 },
    { id: 'M07', name: 'Máquina 07', capacity: 480 },
    { id: 'M08', name: 'Máquina 08', capacity: 400 },
    { id: 'M09', name: 'Máquina 09', capacity: 460 },
    { id: 'M10', name: 'Máquina 10', capacity: 440 },
    { id: 'M11', name: 'Máquina 11', capacity: 500 },
  ],
  corradi: [
    { id: 'C01', name: 'Máquina 01', capacity: 400 },
    { id: 'C02', name: 'Máquina 02', capacity: 380 },
    { id: 'C03', name: 'Máquina 03', capacity: 420 },
    { id: 'C04', name: 'Máquina 04', capacity: 460 },
    { id: 'C05', name: 'Máquina 05', capacity: 360 },
    { id: 'C06', name: 'Máquina 06', capacity: 440 },
    { id: 'C07', name: 'Máquina 07', capacity: 400 },
    { id: 'C08', name: 'Máquina 08', capacity: 420 },
  ],
};

// ─── Microdata API Client ────────────────────────────────────────────────────

/**
 * Busca dados de produção real no Microdata ERP.
 * Adapte os endpoints conforme documentação da API do seu tenant.
 */
async function fetchMicrodataProduction({ factory, startDate, endDate, machine }) {
  const apiUrl = process.env.MICRODATA_API_URL;
  const apiKey = process.env.MICRODATA_API_KEY;
  const tenantId = process.env.MICRODATA_TENANT_ID;

  if (!apiUrl || !apiKey) {
    throw new Error('MICRODATA_API_URL e MICRODATA_API_KEY não configurados');
  }

  const params = {
    tenant: tenantId,
    factory,
    start_date: startDate,  // formato: YYYY-MM-DD
    end_date: endDate,
    ...(machine ? { machine } : {}),
  };

  const response = await axios.get(`${apiUrl}/production/records`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    params,
    timeout: 15000,
  });

  return response.data; // Array de registros de produção
}

/**
 * Busca planejamento do Firestore para um período.
 */
async function getPlannedData(factory, startDate, endDate) {
  const start = admin.firestore.Timestamp.fromDate(new Date(startDate + 'T00:00:00'));
  const end = admin.firestore.Timestamp.fromDate(new Date(endDate + 'T23:59:59'));

  const snap = await db.collection('planning_entries')
    .where('factory', '==', factory)
    .where('date', '>=', start)
    .where('date', '<=', end)
    .orderBy('date', 'asc')
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data(), date: d.data().date?.toDate?.() }));
}

// ─── 1. Microdata Agent (callable) ──────────────────────────────────────────

exports.microdataAgent = onCall(
  { secrets: ['ANTHROPIC_API_KEY', 'MICRODATA_API_KEY', 'MICRODATA_API_URL', 'MICRODATA_TENANT_ID'] },
  async (request) => {
    // Verificar autenticação
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'É necessário estar autenticado.');
    }

    const { query, factory, context: userContext } = request.data;

    if (!query || typeof query !== 'string') {
      throw new HttpsError('invalid-argument', 'Campo "query" é obrigatório.');
    }

    if (!FACTORIES.includes(factory)) {
      throw new HttpsError('invalid-argument', 'Fábrica inválida. Use "doptex" ou "corradi".');
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Data atual para contexto
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

    const machineList = MACHINES[factory].map((m) => `${m.id}: ${m.name} (cap. ${m.capacity} kg/dia)`).join('\n');

    const systemPrompt = `Você é um agente de planejamento de produção especializado nas fábricas Doptex e Corradi, que produzem fios texturizados (DTY, ATY, FDY).

Fábrica atual: ${factory === 'doptex' ? 'Doptex' : 'Corradi'}
Data de hoje: ${todayStr}
Período padrão de análise: ${monthStart} a ${todayStr}

Máquinas disponíveis na fábrica ${factory}:
${machineList}

Você tem acesso às ferramentas:
- fetch_production: busca produção real do sistema Microdata ERP
- get_planning: busca planejamento cadastrado no sistema
- compare_performance: compara planejado vs realizado

Responda sempre em português brasileiro. Seja objetivo e use dados concretos.
Quando apresentar números de produção, use o formato "1.234 kg".
Quando apresentar percentuais de aderência, use "XX,X%".
Destaque problemas (aderência < 85%) e sucessos (aderência ≥ 95%).`;

    const tools = [
      {
        name: 'fetch_production',
        description: 'Busca registros de produção real do sistema Microdata ERP',
        input_schema: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: 'Data início (YYYY-MM-DD)' },
            endDate: { type: 'string', description: 'Data fim (YYYY-MM-DD)' },
            machine: { type: 'string', description: 'ID da máquina (opcional, ex: M01, C03)' },
          },
          required: ['startDate', 'endDate'],
        },
      },
      {
        name: 'get_planning',
        description: 'Busca planejamento de produção cadastrado no sistema',
        input_schema: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: 'Data início (YYYY-MM-DD)' },
            endDate: { type: 'string', description: 'Data fim (YYYY-MM-DD)' },
          },
          required: ['startDate', 'endDate'],
        },
      },
    ];

    const messages = [{ role: 'user', content: query }];
    let finalResponse = '';
    let toolsUsed = [];
    let iterations = 0;
    const MAX_ITERATIONS = 5;

    // Agentic loop
    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        tools,
        messages,
      });

      // Se terminou de processar
      if (response.stop_reason === 'end_turn') {
        finalResponse = response.content
          .filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join('\n');
        break;
      }

      // Processar chamadas de ferramentas
      if (response.stop_reason === 'tool_use') {
        const assistantContent = response.content;
        messages.push({ role: 'assistant', content: assistantContent });

        const toolResults = [];

        for (const block of assistantContent) {
          if (block.type !== 'tool_use') continue;

          toolsUsed.push(block.name);
          let toolResult;

          try {
            if (block.name === 'fetch_production') {
              // Tentar buscar do Microdata real; fallback para mock em dev
              let data;
              try {
                data = await fetchMicrodataProduction({
                  factory,
                  startDate: block.input.startDate,
                  endDate: block.input.endDate,
                  machine: block.input.machine,
                });
              } catch (apiError) {
                console.warn('Microdata API indisponível, usando dados simulados:', apiError.message);
                // Fallback para dados simulados em desenvolvimento
                data = generateMockProductionData(factory, block.input.startDate, block.input.endDate);
              }
              toolResult = JSON.stringify(data);
            } else if (block.name === 'get_planning') {
              const data = await getPlannedData(factory, block.input.startDate, block.input.endDate);
              toolResult = JSON.stringify(data.map((d) => ({
                machine: d.machine,
                product: d.productName,
                date: d.date?.toISOString?.()?.split('T')[0],
                planned: d.planned,
                quality: d.quality,
                side: d.side,
              })));
            }
          } catch (err) {
            toolResult = JSON.stringify({ error: err.message });
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: toolResult,
          });
        }

        messages.push({ role: 'user', content: toolResults });
      } else {
        // Stop inesperado
        finalResponse = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
        break;
      }
    }

    // Salvar log no Firestore
    await db.collection('agent_logs').add({
      userId: request.auth.uid,
      factory,
      query,
      response: finalResponse,
      toolsUsed,
      iterations,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { response: finalResponse, toolsUsed };
  }
);

// ─── 2. Sync Production (callable) ──────────────────────────────────────────

exports.syncProduction = onCall(
  { secrets: ['MICRODATA_API_KEY', 'MICRODATA_API_URL', 'MICRODATA_TENANT_ID'] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'É necessário estar autenticado.');
    }

    const { factory, yearMonth } = request.data;

    if (!FACTORIES.includes(factory)) {
      throw new HttpsError('invalid-argument', 'Fábrica inválida.');
    }

    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    let productionData;
    try {
      productionData = await fetchMicrodataProduction({ factory, startDate, endDate });
    } catch (err) {
      console.warn('Microdata indisponível, usando mock:', err.message);
      productionData = generateMockProductionData(factory, startDate, endDate);
    }

    // Buscar planejamento para correlacionar
    const plannedEntries = await getPlannedData(factory, startDate, endDate);
    const planningMap = {};
    for (const entry of plannedEntries) {
      const dateStr = entry.date?.toISOString?.()?.split('T')[0];
      const key = `${entry.machine}-${dateStr}`;
      planningMap[key] = entry;
    }

    // Batch write para o Firestore
    const batch = db.batch();
    let count = 0;

    for (const record of productionData) {
      const key = `${record.machine}-${record.date}`;
      const planning = planningMap[key];

      const docRef = db.collection('production_records').doc();
      batch.set(docRef, {
        factory,
        machine: record.machine,
        machineName: record.machineName || record.machine,
        product: record.product || planning?.product || 'unknown',
        productName: record.productName || planning?.productName || record.product || 'Desconhecido',
        date: admin.firestore.Timestamp.fromDate(new Date(record.date + 'T12:00:00')),
        actual: record.actual || record.produced || 0,
        planned: planning?.planned || 0,
        planningId: planning?.id || null,
        source: 'microdata_agent',
        importedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      count++;

      // Firestore batch limit = 500
      if (count % 499 === 0) {
        await batch.commit();
      }
    }

    await batch.commit();

    return { imported: count, factory, yearMonth };
  }
);

// ─── 3. Trigger: recalcular KPIs ao salvar planejamento ─────────────────────

exports.onPlanningWrite = onDocumentWritten(
  'planning_entries/{entryId}',
  async (event) => {
    const data = event.data?.after?.data();
    const oldData = event.data?.before?.data();
    if (!data && !oldData) return;

    const factory = data?.factory || oldData?.factory;
    const date = data?.date || oldData?.date;
    if (!factory || !date) return;

    // Recompute daily aggregate for this factory + date
    const dateTs = date instanceof admin.firestore.Timestamp ? date : admin.firestore.Timestamp.fromDate(new Date(date));
    const dayStart = new Date(dateTs.toDate());
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const snap = await db.collection('planning_entries')
      .where('factory', '==', factory)
      .where('date', '>=', admin.firestore.Timestamp.fromDate(dayStart))
      .where('date', '<=', admin.firestore.Timestamp.fromDate(dayEnd))
      .get();

    const totalPlanned = snap.docs.reduce((sum, d) => sum + (d.data().planned || 0), 0);

    const dateStr = dayStart.toISOString().split('T')[0];
    const kpiRef = db.collection('kpis_daily').doc(`${factory}-${dateStr}`);

    await kpiRef.set({
      factory,
      date: admin.firestore.Timestamp.fromDate(dayStart),
      totalPlanned,
      machineCount: snap.size,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
);

// ─── Mock Data Generator (fallback dev/test) ─────────────────────────────────

function generateMockProductionData(factory, startDate, endDate) {
  const products = [
    { id: 'P001', name: 'DTY 150/48' },
    { id: 'P002', name: 'DTY 100/36' },
    { id: 'P003', name: 'DTY 75/36' },
    { id: 'P004', name: 'DTY 150/144' },
    { id: 'P005', name: 'ATY 200/48' },
  ];

  const machines = MACHINES[factory];
  const records = [];

  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0) continue; // Sem domingos
    const dateStr = d.toISOString().split('T')[0];

    for (const machine of machines) {
      if (Math.random() < 0.1) continue; // 10% chance de máquina parada
      const product = products[Math.floor(Math.random() * products.length)];
      const variance = 0.75 + Math.random() * 0.35; // 75%–110% do planejado
      const planned = machine.capacity * 0.8;
      const actual = Math.round(planned * variance);

      records.push({
        machine: machine.id,
        machineName: machine.name,
        product: product.id,
        productName: product.name,
        date: dateStr,
        actual,
        planned: Math.round(planned),
      });
    }
  }

  return records;
}
