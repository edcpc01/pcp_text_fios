/**
 * scripts/seed-firestore.js
 *
 * Popula o Firestore com dados iniciais:
 *  - Usuários de referência (para Firestore, não para Auth)
 *  - Catálogo de máquinas
 *  - Catálogo de produtos
 *  - Dados de planejamento para o mês atual (demo)
 *
 * Uso:
 *   node scripts/seed-firestore.js
 *
 * Requer:
 *   npm install firebase-admin dotenv
 *   Configurar GOOGLE_APPLICATION_CREDENTIALS ou FIREBASE_PROJECT_ID + emulador
 */

const admin = require('firebase-admin');
const path = require('path');

// Para emulador local:
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

admin.initializeApp({ projectId: 'corradi-production' });
const db = admin.firestore();

// ─── Dados de referência ─────────────────────────────────────────────────────

const MACHINES = {
  doptex: [
    { id: 'M01', name: 'Máquina 01', sides: 2, capacity: 420, active: true },
    { id: 'M02', name: 'Máquina 02', sides: 2, capacity: 380, active: true },
    { id: 'M03', name: 'Máquina 03', sides: 2, capacity: 460, active: true },
    { id: 'M04', name: 'Máquina 04', sides: 2, capacity: 440, active: true },
    { id: 'M05', name: 'Máquina 05', sides: 2, capacity: 500, active: true },
    { id: 'M06', name: 'Máquina 06', sides: 2, capacity: 420, active: true },
    { id: 'M07', name: 'Máquina 07', sides: 2, capacity: 480, active: true },
    { id: 'M08', name: 'Máquina 08', sides: 1, capacity: 400, active: true },
    { id: 'M09', name: 'Máquina 09', sides: 2, capacity: 460, active: true },
    { id: 'M10', name: 'Máquina 10', sides: 2, capacity: 440, active: true },
    { id: 'M11', name: 'Máquina 11', sides: 2, capacity: 500, active: true },
  ],
  corradi: [
    { id: 'C01', name: 'Máquina 01', sides: 2, capacity: 400, active: true },
    { id: 'C02', name: 'Máquina 02', sides: 2, capacity: 380, active: true },
    { id: 'C03', name: 'Máquina 03', sides: 2, capacity: 420, active: true },
    { id: 'C04', name: 'Máquina 04', sides: 2, capacity: 460, active: true },
    { id: 'C05', name: 'Máquina 05', sides: 1, capacity: 360, active: true },
    { id: 'C06', name: 'Máquina 06', sides: 2, capacity: 440, active: true },
    { id: 'C07', name: 'Máquina 07', sides: 2, capacity: 400, active: true },
    { id: 'C08', name: 'Máquina 08', sides: 2, capacity: 420, active: true },
  ],
};

const PRODUCTS = [
  { id: 'P001', name: 'DTY 150/48', type: 'DTY', denier: 150, filaments: 48 },
  { id: 'P002', name: 'DTY 100/36', type: 'DTY', denier: 100, filaments: 36 },
  { id: 'P003', name: 'DTY 75/36',  type: 'DTY', denier: 75,  filaments: 36 },
  { id: 'P004', name: 'DTY 150/144',type: 'DTY', denier: 150, filaments: 144 },
  { id: 'P005', name: 'DTY 300/96', type: 'DTY', denier: 300, filaments: 96 },
  { id: 'P006', name: 'ATY 200/48', type: 'ATY', denier: 200, filaments: 48 },
  { id: 'P007', name: 'FDY 150/48', type: 'FDY', denier: 150, filaments: 48 },
  { id: 'P008', name: 'DTY 100/48', type: 'DTY', denier: 100, filaments: 48 },
  { id: 'P009', name: 'DTY 200/96', type: 'DTY', denier: 200, filaments: 96 },
  { id: 'P010', name: 'DTY 50/24',  type: 'DTY', denier: 50,  filaments: 24 },
];

// ─── Seed Funções ────────────────────────────────────────────────────────────

async function seedMachines() {
  console.log('📦 Seeding machines...');
  const batch = db.batch();

  for (const [factory, machines] of Object.entries(MACHINES)) {
    for (const machine of machines) {
      const ref = db.collection('machines').doc(`${factory}-${machine.id}`);
      batch.set(ref, { ...machine, factory, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    }
  }

  await batch.commit();
  console.log(`   ✅ ${Object.values(MACHINES).flat().length} máquinas criadas`);
}

async function seedProducts() {
  console.log('📦 Seeding products...');
  const batch = db.batch();

  for (const product of PRODUCTS) {
    const ref = db.collection('products').doc(product.id);
    batch.set(ref, { ...product, active: true, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  }

  await batch.commit();
  console.log(`   ✅ ${PRODUCTS.length} produtos criados`);
}

async function seedPlanningData(factory, yearMonth) {
  console.log(`📦 Seeding planning data: ${factory} / ${yearMonth}...`);

  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const machines = MACHINES[factory];
  const products = PRODUCTS.slice(0, 5); // Usar os 5 primeiros produtos
  const sides = ['Lado A', 'Lado B'];

  const batch = db.batch();
  let count = 0;

  for (const machine of machines) {
    // Selecionar produto aleatório (fixo por máquina durante o mês)
    const product = products[Math.floor(Math.random() * products.length)];
    const activeSides = machine.sides === 1 ? ['Lado A'] : sides;

    for (const side of activeSides) {
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);

        // Pular domingos
        if (date.getDay() === 0) continue;

        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const plannedPerSide = Math.round((machine.capacity * 0.8) / machine.sides);

        const ref = db.collection('planning_entries').doc();
        batch.set(ref, {
          factory,
          machine: machine.id,
          machineName: machine.name,
          product: product.id,
          productName: product.name,
          date: admin.firestore.Timestamp.fromDate(new Date(dateStr + 'T12:00:00')),
          planned: plannedPerSide,
          quality: 'A',
          side,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        count++;

        // Flush a cada 400 docs (limite é 500)
        if (count % 400 === 0) {
          await batch.commit();
          console.log(`   → ${count} entradas escritas...`);
        }
      }
    }
  }

  await batch.commit();
  console.log(`   ✅ ${count} entradas de planejamento criadas`);
}

async function seedProductionData(factory, yearMonth) {
  console.log(`📦 Seeding production data: ${factory} / ${yearMonth}...`);

  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const currentDay = today.getMonth() + 1 === month && today.getFullYear() === year
    ? today.getDate() - 1  // Até ontem
    : daysInMonth;

  const machines = MACHINES[factory];
  const products = PRODUCTS.slice(0, 5);

  const batch = db.batch();
  let count = 0;

  for (const machine of machines) {
    const product = products[Math.floor(Math.random() * products.length)];

    for (let day = 1; day <= currentDay; day++) {
      const date = new Date(year, month - 1, day);
      if (date.getDay() === 0) continue;

      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const plannedTotal = Math.round(machine.capacity * 0.8);
      const variance = 0.78 + Math.random() * 0.32; // 78%–110%
      const actual = Math.round(plannedTotal * variance);

      const ref = db.collection('production_records').doc();
      batch.set(ref, {
        factory,
        machine: machine.id,
        machineName: machine.name,
        product: product.id,
        productName: product.name,
        date: admin.firestore.Timestamp.fromDate(new Date(dateStr + 'T12:00:00')),
        actual,
        planned: plannedTotal,
        planningId: null,
        source: 'microdata_agent',
        importedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      count++;

      if (count % 400 === 0) {
        await batch.commit();
        console.log(`   → ${count} registros de produção escritos...`);
      }
    }
  }

  await batch.commit();
  console.log(`   ✅ ${count} registros de produção criados`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  console.log('\n🚀 Iniciando seed do Firestore...');
  console.log(`   Projeto: corradi-production`);
  console.log(`   Mês: ${yearMonth}\n`);

  try {
    await seedMachines();
    await seedProducts();

    for (const factory of ['doptex', 'corradi']) {
      await seedPlanningData(factory, yearMonth);
      await seedProductionData(factory, yearMonth);
    }

    console.log('\n✅ Seed concluído com sucesso!\n');
  } catch (err) {
    console.error('\n❌ Erro durante o seed:', err);
    process.exit(1);
  }

  process.exit(0);
}

main();
