/**
 * csvSync.js — Utilitários para leitura e parsing de CSV do Microdata
 *
 * Formato esperado do CSV de Produção Realizada:
 *   DATA;MAQUINA;CODIGO_PRODUTO;DESCRICAO;QUANTIDADE
 *   01/04/2026;M01;P319;PES TEXT A AR;1238.5
 *
 * Formato esperado do CSV de Estoque (MP e PA):
 *   CODIGO;DESCRICAO;ESTOQUE
 *   100001;PES POY 1x150/48;5420.3
 *
 * O campo que liga o CSV ao PWA é o CODIGO_PRODUTO, comparado contra
 * product.id e product.codigoMicrodata dos produtos cadastrados no Firebase.
 */

// ─── File System Access API ───────────────────────────────────────────────────
// Armazena file handles no IndexedDB com fallback silencioso em caso de erro de disco

const IDB_DB    = 'pcp-csv-handles';
const IDB_STORE = 'handles';

function openIDB() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(IDB_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

export async function saveFileHandle(key, handle) {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(handle, key);
        tx.oncomplete = resolve;
        tx.onerror    = resolve; // falha silenciosa — handle não será reutilizado
      } catch { resolve(); }
    });
  } catch { /* disco cheio ou iDB indisponível — ignora */ }
}

export async function loadFileHandle(key) {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      try {
        const tx  = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror   = () => resolve(null);
      } catch { resolve(null); }
    });
  } catch {
    return null;
  }
}

export async function clearFileHandle(key) {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(key);
        tx.oncomplete = resolve;
        tx.onerror    = resolve;
      } catch { resolve(); }
    });
  } catch { /* ignora */ }
}

/**
 * Lê silenciosamente o arquivo salvo SEM abrir picker.
 * Retorna File se o handle existe e a permissão está ativa, null caso contrário.
 * Usado para auto-sync em background (sem interação do usuário).
 */
export async function readSavedFile(handleKey) {
  const saved = await loadFileHandle(handleKey);
  if (!saved) return null;
  try {
    const perm = await saved.queryPermission({ mode: 'read' });
    if (perm === 'granted') return await saved.getFile();
  } catch { /* handle inválido */ }
  return null;
}

/**
 * Tenta reutilizar um handle salvo. Se não tiver ou permissão negada,
 * abre o file picker e salva o novo handle.
 * Retorna File ou null (se o usuário cancelar).
 */
export async function pickOrReuseFile(handleKey, pickerOptions = {}) {
  // Tenta handle salvo
  const saved = await loadFileHandle(handleKey);
  if (saved) {
    try {
      const perm = await saved.queryPermission({ mode: 'read' });
      if (perm === 'granted') {
        return await saved.getFile();
      }
      const req = await saved.requestPermission({ mode: 'read' });
      if (req === 'granted') {
        return await saved.getFile();
      }
    } catch {
      // handle inválido — cai no picker
    }
  }

  // File picker
  if (!window.showOpenFilePicker) {
    // Fallback: input[type=file] (browsers sem File System Access API)
    return null; // caller deve usar input[type=file]
  }

  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'CSV', accept: { 'text/csv': ['.csv', '.txt'] } }],
      multiple: false,
      ...pickerOptions,
    });
    await saveFileHandle(handleKey, handle);
    return await handle.getFile();
  } catch (err) {
    if (err.name === 'AbortError') return null; // usuário cancelou
    throw err;
  }
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function detectDelimiter(firstLine) {
  const semis  = (firstLine.match(/;/g)  || []).length;
  const commas = (firstLine.match(/,/g)  || []).length;
  const tabs   = (firstLine.match(/\t/g) || []).length;
  if (tabs > semis && tabs > commas) return '\t';
  if (semis >= commas) return ';';
  return ',';
}

function parseValue(str) {
  if (!str) return str;
  return str.trim().replace(/^["']|["']$/g, '');
}

function parseNumber(str) {
  if (!str) return NaN;
  // Suporte a formatos BR (1.250,50) e US (1250.50)
  const s = str.trim().replace(/\s/g, '');
  if (s.includes(',') && s.includes('.')) {
    // Se vírgula depois do ponto → US style: 1,250.50
    if (s.lastIndexOf(',') < s.lastIndexOf('.')) return parseFloat(s.replace(/,/g, ''));
    // Caso contrário → BR style: 1.250,50
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  }
  if (s.includes(',')) return parseFloat(s.replace(',', '.'));
  return parseFloat(s);
}

function parseDate(str) {
  if (!str) return null;
  const s = str.trim();
  // DD/MM/YYYY ou DD-MM-YYYY
  const brMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

/** Normaliza nome de coluna para comparação */
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

/** Detecta índice de coluna a partir de possíveis nomes */
function findCol(headers, candidates) {
  for (const c of candidates) {
    const idx = headers.findIndex((h) => norm(h) === norm(c));
    if (idx !== -1) return idx;
  }
  // Busca parcial
  for (const c of candidates) {
    const idx = headers.findIndex((h) => norm(h).includes(norm(c)));
    if (idx !== -1) return idx;
  }
  return -1;
}

// Classificações do Microdata excluídas em todos os parsers (consignação/análise)
const CLASSIF_EXCLUIDAS = ['a3', 'as'];

// ─── Parse CSV de Produção Realizada ─────────────────────────────────────────

/**
 * Retorna array de { date, machine, productCode, productName, quantity }
 * date: 'YYYY-MM-DD'
 */
export function parseProducaoCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const delim   = detectDelimiter(lines[0]);
  const headers = lines[0].split(delim).map(parseValue);

  const iDate    = findCol(headers, ['data', 'date', 'dt', 'dia']);
  const iMachine = findCol(headers, ['maquina', 'machine', 'maq', 'cod_maquina', 'codigo_maquina', 'equipamento']);
  const iCode    = findCol(headers, ['codigo_produto', 'cod_produto', 'produto', 'product', 'codigo', 'cod', 'code', 'item']);
  const iName    = findCol(headers, ['descricao', 'description', 'desc', 'nome', 'name']);
  const iQty     = findCol(headers, ['quantidade', 'qtd', 'realizado', 'produzido', 'kg', 'qty', 'amount', 'peso']);
  const iClassif = findCol(headers, ['classif', 'classificacao', 'classification', 'class']);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim).map(parseValue);
    if (cols.length < 2) continue;

    // Exclui registros com classificação A3 ou AS (consignação/análise)
    if (iClassif >= 0) {
      const classif = (cols[iClassif] || '').trim().toLowerCase();
      if (CLASSIF_EXCLUIDAS.includes(classif)) continue;
    }

    const date        = parseDate(iDate    >= 0 ? cols[iDate]    : cols[0]);
    const machine     = iMachine >= 0 ? cols[iMachine] : cols[1];
    const productCode = iCode    >= 0 ? cols[iCode]    : cols[2];
    const productName = iName    >= 0 ? cols[iName]    : '';
    const qty         = parseNumber(iQty >= 0 ? cols[iQty] : cols[3]);

    if (!date || !productCode || isNaN(qty)) continue;

    rows.push({ date, machine: (machine || '').trim(), productCode: (productCode || '').trim(), productName: (productName || '').trim(), quantity: qty });
  }
  return rows;
}

// ─── Parse CSV de Estoque ─────────────────────────────────────────────────────

/**
 * Retorna array de { code, description, stockKg, lots }
 *
 * Suporta o formato de exportação do Microdata ERP (consulta 0053TE - Estoque de Fios):
 *   Empresa;Produto;Descricao;Cor;Classif;Lote;Fornecedor;...;Peso;...
 *
 * Linhas com Classif "A3" ou "AS" são excluídas pois representam lotes
 * em análise/consignação que não devem compor o saldo disponível.
 * Os valores de Peso são agrupados por código de produto (soma por produto).
 * Cada produto retorna também o array `lots` com os lotes individuais disponíveis.
 */
export function parseEstoqueCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const delim   = detectDelimiter(lines[0]);
  const headers = lines[0].split(delim).map(parseValue);

  const iCode    = findCol(headers, ['produto', 'codigo', 'cod', 'code', 'item', 'product']);
  const iDesc    = findCol(headers, ['descricao', 'description', 'desc', 'nome', 'name']);
  const iStock   = findCol(headers, ['peso', 'estoque', 'saldo', 'quantidade', 'qtd', 'stock', 'kg', 'qty']);
  const iClassif = findCol(headers, ['classif', 'classificacao', 'classification', 'class']);
  const iLote    = findCol(headers, ['lote', 'lot', 'batch', 'nr_lote', 'num_lote']);
  const iEmpresa = findCol(headers, ['empresa', 'company', 'emp', 'filial', 'unidade']);

  // Agrupa por código — o Microdata retorna uma linha por lote, precisamos somar
  const accumulator = {}; // { code: { description, stockKg, lots[] } }

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim).map(parseValue);
    if (cols.length < 2) continue;

    // Filtra classificações excluídas (A3, AS, etc.)
    if (iClassif >= 0) {
      const classif = (cols[iClassif] || '').trim().toLowerCase();
      if (CLASSIF_EXCLUIDAS.includes(classif)) continue;
    }

    const code    = iCode  >= 0 ? cols[iCode]  : cols[0];
    const desc    = iDesc  >= 0 ? cols[iDesc]  : cols[1];
    const stockKg = parseNumber(iStock >= 0 ? cols[iStock] : cols[2]);
    const lote    = iLote    >= 0 ? (cols[iLote]    || '').trim() : '';
    const empresa = iEmpresa >= 0 ? (cols[iEmpresa] || '').trim() : '';

    if (!code || isNaN(stockKg)) continue;

    const key = (code || '').trim();
    if (!accumulator[key]) {
      accumulator[key] = { description: (desc || '').trim(), stockKg: 0, lots: [] };
    }
    accumulator[key].stockKg += stockKg;
    if (lote || empresa) {
      accumulator[key].lots.push({ lote, empresa, pesoKg: stockKg });
    }
  }

  return Object.entries(accumulator).map(([code, { description, stockKg, lots }]) => ({
    code,
    description,
    stockKg,
    lots,
  }));
}

// ─── Product Lookup ───────────────────────────────────────────────────────────

/**
 * Dado um código do CSV, encontra o produto cadastrado no Firebase.
 * Compara contra product.id e product.codigoMicrodata (case-insensitive).
 */
export function findProductByCode(products, csvCode) {
  if (!csvCode) return null;
  const c = String(csvCode).toLowerCase().trim();
  return products.find(
    (p) =>
      String(p.id || '').toLowerCase() === c ||
      String(p.codigoMicrodata || '').toLowerCase() === c,
  ) || null;
}
