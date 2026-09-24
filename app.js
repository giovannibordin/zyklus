import {
  FLOW, PAIN_BAND_VALUES, SYMPTOMS,
  painBand, analyse, addDays, diffDays, fromKey, toKey, todayKey, frequency,
} from './cycle.js';
import { T } from './strings.js';

const APP_VERSION = '1.0.0';

// =============================================================================
// 1. Archivio (IndexedDB)
// =============================================================================

const DB_NAME = 'ciclo';
const STORE = 'days';
const META = 'meta';
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'date' });
      // Versione 2: un piccolo archivio a parte per la data dell'ultimo backup.
      // Non finisce fra i giorni, altrimenti sporcherebbe le statistiche.
      if (!d.objectStoreNames.contains(META)) d.createObjectStore(META, { keyPath: 'k' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(mode) { return db.transaction(STORE, mode).objectStore(STORE); }

function getMeta(k) {
  return new Promise((resolve) => {
    const r = db.transaction(META, 'readonly').objectStore(META).get(k);
    r.onsuccess = () => resolve(r.result ? r.result.v : null);
    r.onerror = () => resolve(null);
  });
}

function setMeta(k, v) {
  return new Promise((resolve) => {
    const r = db.transaction(META, 'readwrite').objectStore(META).put({ k, v });
    r.onsuccess = () => resolve();
    r.onerror = () => resolve();
  });
}

function getAll() {
  return new Promise((resolve, reject) => {
    const r = tx('readonly').getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
}

function put(rec) {
  return new Promise((resolve, reject) => {
    const r = tx('readwrite').put(rec);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

function del(date) {
  return new Promise((resolve, reject) => {
    const r = tx('readwrite').delete(date);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

function clearAll() {
  return new Promise((resolve, reject) => {
    const r = tx('readwrite').clear();
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

// =============================================================================
// 2. Stato
// =============================================================================

let logs = [];              // tutte le registrazioni
let byDate = new Map();
let lastBackup = null;      // ISO string, oppure null se non è mai stato fatto
let anchor = todayKey();    // mese mostrato nel calendario
let editing = null;         // chiave del giorno aperto nell'editor
let draft = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

async function reload() {
  logs = await getAll();
  logs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  byDate = new Map(logs.map((l) => [l.date, l]));
  lastBackup = await getMeta('lastBackup');
}

/**
 * La spunta «schlechter Schlaf» è diventata una scala. Chi aveva già usato la
 * versione precedente non deve perdere quelle notti: la spunta vale «Schlecht».
 * Gira una volta sola, poi resta un flag nel piccolo archivio meta.
 */
async function migrateSleep() {
  if (await getMeta('sleepMigrated')) return;
  const affected = logs.filter((l) => Array.isArray(l.symptoms) && l.symptoms.includes('poor_sleep'));
  for (const l of affected) {
    await put({
      ...l,
      sleep: (l.sleep === null || l.sleep === undefined) ? 2 : l.sleep,
      symptoms: l.symptoms.filter((k) => k !== 'poor_sleep'),
    });
  }
  await setMeta('sleepMigrated', true);
  if (affected.length) await reload();
}

/**
 * Giorni dall'ultimo backup, null se non ne è mai stato fatto uno.
 * Serve al promemoria: l'esportazione è l'unica protezione verificata dei dati,
 * quindi non può dipendere dal fatto che qualcuno se ne ricordi.
 */
function daysSinceBackup() {
  if (!lastBackup) return null;
  const d = new Date(lastBackup);
  if (isNaN(d)) return null;
  return diffDays(toKey(d), todayKey());
}

// =============================================================================
// 3. Testi e formattazione
//    Tutte le stringhe vengono da strings.js: qui non ce n'è nessuna scritta
//    a mano. Per cambiare lingua si tocca solo quel file.
// =============================================================================

/** Risolve "ed.painTitle" dentro l'oggetto T. */
function tr(path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), T);
}

/** Riempie il markup statico marcato con data-t / data-t-aria / data-t-ph. */
function applyStrings() {
  $$('[data-t]').forEach((n) => { n.textContent = tr(n.dataset.t); });
  $$('[data-t-aria]').forEach((n) => { n.setAttribute('aria-label', tr(n.dataset.tAria)); });
  $$('[data-t-ph]').forEach((n) => { n.setAttribute('placeholder', tr(n.dataset.tPh)); });

  const wd = $('#weekdays');
  wd.textContent = '';
  T.weekdayInitials.forEach((s) => {
    const d = document.createElement('div');
    d.textContent = s;
    wd.appendChild(d);
  });
}

// Formati di data tedeschi: 4. August 2026, Dienstag, 4. August, 4. Aug 2026.
function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${T.months[m - 1]} ${y}`;
}

function longDate(key) {
  const d = fromKey(key);
  return `${T.weekdays[d.getDay()]}, ${d.getDate()}. ${T.months[d.getMonth()]}`;
}

function fullDate(key) {
  const d = fromKey(key);
  return `${d.getDate()}. ${T.monthsShort[d.getMonth()]} ${d.getFullYear()}`;
}

// Il tedesco usa la virgola come separatore decimale, come l'italiano.
const n1 = (x) => (x === null || x === undefined ? '—' : x.toFixed(1).replace('.', ','));
const n0 = (x) => (x === null || x === undefined ? '—' : Math.round(x).toString());

const painLabel = (nrs) => T.pain[painBand(nrs)];
const symptomLabel = (key) => (SYMPTOMS.find((s) => s.key === key) || {}).label || key;

// =============================================================================
// 4. Calendario
// =============================================================================

function renderCalendar() {
  const a = analyse(logs);
  const today = todayKey();
  $('#monthlabel').textContent = monthLabel(anchor);

  const [y, m] = anchor.split('-').map(Number);
  $('#nextmonth').disabled = `${y}-${String(m).padStart(2, '0')}` >= today.slice(0, 7);

  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const jsDow = fromKey(first).getDay();          // 0 = domenica
  const leading = (jsDow + 6) % 7;                // griglia che parte da lunedì
  const daysInMonth = new Date(y, m, 0).getDate();

  const grid = $('#grid');
  grid.textContent = '';

  for (let i = 0; i < leading; i++) {
    const c = document.createElement('div');
    c.className = 'day empty';
    grid.appendChild(c);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const key = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const log = byDate.get(key);
    const future = key > today;
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'day p' + painBand(log ? log.pain : 0);
    if (!log) cell.classList.add('nolog');
    if (future) cell.classList.add('future');
    if (key === today) cell.classList.add('today');
    cell.disabled = future;

    const num = document.createElement('span');
    num.textContent = String(i);
    cell.appendChild(num);

    const bar = document.createElement('span');
    bar.className = 'flow';
    const f = log ? log.flow : 0;
    if (f > 0) bar.classList.add('f' + f);
    else if (a.menstrualDays.has(key)) bar.classList.add('gap');
    cell.appendChild(bar);

    if (log && (log.symptoms.length || log.analgesic)) {
      const dot = document.createElement('span');
      dot.className = 'dot';
      cell.appendChild(dot);
    }

    const parts = [longDate(key)];
    if (log) {
      parts.push(T.cal.ariaPain(log.pain));
      if (log.flow > 0) parts.push(T.cal.ariaFlow(T.flow[log.flow]));
    } else if (!future) parts.push(T.cal.ariaNotLogged);
    cell.setAttribute('aria-label', parts.join(', '));

    cell.addEventListener('click', () => openEditor(key));
    grid.appendChild(cell);
  }

  renderLegend();
  renderStatus(a);
  renderBackupReminder();
}

/**
 * Promemoria del backup, in cima al calendario.
 * Compare solo quando serve davvero: dopo due settimane di dati senza nessun
 * backup, oppure quando l'ultimo risale a più di un mese fa.
 */
function renderBackupReminder() {
  const box = $('#backupreminder');
  box.textContent = '';
  box.classList.add('hidden');
  if (!logs.length) return;

  const since = daysSinceBackup();
  const dataAge = diffDays(logs[0].date, todayKey());
  let msg = null;
  if (since === null && dataAge >= 14) msg = T.ex.neverBackedUp;
  else if (since !== null && since >= 30) msg = T.ex.backupOld(since);
  if (!msg) return;

  box.textContent = msg;
  box.classList.remove('hidden');
  box.onclick = () => showView('export');
}

function renderLegend() {
  const el2 = $('#legend');
  el2.textContent = '';
  const add = (html) => { const d = document.createElement('div'); d.className = 'item'; d.innerHTML = html; el2.appendChild(d); };
  T.pain.forEach((label, i) => add(`<span class="sw" style="background:var(--pain-${i})"></span>${label}`));
  add(`<span class="sw" style="background:none"></span>${T.cal.notLogged}`);
  for (let f = 1; f <= 3; f++) add(`<span class="bar" style="background:var(--flow-${f})"></span>${T.flow[f]}`);
}

function renderStatus(a) {
  const c = $('#statuscard');
  c.textContent = '';
  const h = document.createElement('h2');

  if (!a.open) {
    h.textContent = T.cal.noPeriodTitle;
    c.appendChild(h);
    note(c, T.cal.noPeriodNote);
    return;
  }

  h.textContent = T.cal.cycleDay(a.openDay);
  c.appendChild(h);
  row(c, T.cal.start, fullDate(a.open.start));
  if (a.predictedNext) {
    row(c, T.cal.predicted, fullDate(a.predictedNext));
    note(c, T.cal.inDays(diffDays(a.today, a.predictedNext)) + ' ' + T.cal.predNote);
  } else {
    note(c, T.cal.needThree);
  }
}

// =============================================================================
// 5. Editor del giorno
// =============================================================================

function buildSegments() {
  const p = $('#seg-pain');
  p.textContent = '';
  PAIN_BAND_VALUES.forEach((value, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.v = value;
    btn.innerHTML = `${T.pain[i]}<span class="sub">${value}</span>`;
    btn.addEventListener('click', () => { draft.pain = value; syncSheet(); });
    p.appendChild(btn);
  });

  const f = $('#seg-flow');
  f.textContent = '';
  T.flow.forEach((label, v) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.v = v;
    btn.textContent = label;
    btn.addEventListener('click', () => { draft.flow = v; syncSheet(); });
    f.appendChild(btn);
  });

  const sl = $('#seg-sleep');
  sl.textContent = '';
  T.sleep.forEach((label, v) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.v = v;
    btn.textContent = label;
    // Ritoccare la stessa stufa cancella la risposta: «non l'ho segnato» deve
    // restare distinto da «ho dormito bene».
    btn.addEventListener('click', () => {
      draft.sleep = draft.sleep === v ? null : v;
      syncSheet();
    });
    sl.appendChild(btn);
  });

  const list = $('#symlist');
  list.textContent = '';
  SYMPTOMS.forEach((s) => {
    const lab = document.createElement('label');
    lab.className = 'check';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.key = s.key;
    cb.addEventListener('change', () => {
      if (cb.checked) { if (!draft.symptoms.includes(s.key)) draft.symptoms.push(s.key); }
      else draft.symptoms = draft.symptoms.filter((k) => k !== s.key);
      syncSheet();
    });
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(s.label));
    list.appendChild(lab);
  });
}

function openEditor(key) {
  editing = key;
  const ex = byDate.get(key);
  draft = ex
    ? { ...ex, symptoms: [...ex.symptoms], sleep: ex.sleep ?? null }
    : { date: key, pain: 0, flow: 0, sleep: null, symptoms: [], analgesic: false, analgesicNote: '', note: '' };

  $('#sheettitle').textContent = longDate(key);
  $('#btn-delete').classList.toggle('hidden', !ex);
  $('#chk-precise').checked = !PAIN_BAND_VALUES.includes(draft.pain);
  $('#symdetails').open = draft.symptoms.length > 0;
  syncSheet();
  $('#sheet').classList.add('open');
  $('#sheetbody').scrollTop = 0;
}

function syncSheet() {
  // Se il voto è preciso e non coincide con un pulsante, si evidenzia la fascia.
  const target = PAIN_BAND_VALUES.includes(draft.pain)
    ? draft.pain
    : PAIN_BAND_VALUES[painBand(draft.pain)];
  $$('#seg-pain button').forEach((b) => b.setAttribute('aria-pressed', Number(b.dataset.v) === target));
  $$('#seg-flow button').forEach((b) => b.setAttribute('aria-pressed', Number(b.dataset.v) === draft.flow));
  $$('#seg-sleep button').forEach((b) => b.setAttribute('aria-pressed',
    draft.sleep !== null && draft.sleep !== undefined && Number(b.dataset.v) === draft.sleep));

  const precise = $('#chk-precise').checked;
  $('#precise-wrap').classList.toggle('hidden', !precise);
  $('#rng-pain').value = draft.pain;
  $('#precise-val').textContent = `${draft.pain} / 10`;

  $$('#symlist input').forEach((cb) => { cb.checked = draft.symptoms.includes(cb.dataset.key); });
  $('#symsummary').textContent = draft.symptoms.length
    ? T.ed.symptomsN(draft.symptoms.length) : T.ed.symptoms;

  $('#chk-analg').checked = draft.analgesic;
  $('#analg-wrap').classList.toggle('hidden', !draft.analgesic);
  $('#txt-analg').value = draft.analgesicNote || '';
  $('#txt-note').value = draft.note || '';
}

function closeEditor() {
  $('#sheet').classList.remove('open');
  editing = null;
  draft = null;
}

async function saveEditor() {
  draft.note = $('#txt-note').value.trim();
  draft.analgesicNote = draft.analgesic ? $('#txt-analg').value.trim() : '';
  draft.updated = new Date().toISOString();
  // Si salva anche se è tutto a zero: «oggi nessun dolore» è un dato.
  // Un giorno assente vuol dire che l'app non è stata aperta, che è altro.
  await put(draft);
  await reload();
  closeEditor();
  renderCalendar();
  renderStats();
  renderExport();
}

// =============================================================================
// 6. Grafici (SVG scritto a mano: nessuna libreria, funziona offline)
// =============================================================================

const svgNS = 'http://www.w3.org/2000/svg';
function el(name, attrs = {}, text = null) {
  const n = document.createElementNS(svgNS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== null) n.textContent = text;
  return n;
}

/** Barre: durata di ogni ciclo, con la banda normale FIGO 24–38. */
function cycleChart(cycles, readout) {
  const W = 320, H = 170, ML = 26, MR = 8, MT = 12, MB = 26;
  const svg = el('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img',
    'aria-label': T.st.cycleChart });

  const lens = cycles.map((c) => c.length);
  const yMax = Math.max(42, Math.ceil(Math.max(...lens) / 10) * 10);
  const px = (x) => ML + (x * (W - ML - MR)) / cycles.length;
  const py = (v) => MT + (H - MT - MB) * (1 - v / yMax);

  for (const t of [0, 14, 28, 42].filter((t) => t <= yMax)) {
    svg.appendChild(el('line', { class: 'gridline', x1: ML, x2: W - MR, y1: py(t), y2: py(t) }));
    svg.appendChild(el('text', { class: 'tick', x: ML - 4, y: py(t) + 3, 'text-anchor': 'end' }, String(t)));
  }
  // Banda normale FIGO: riferimento recessivo, non un allarme.
  for (const v of [24, 38]) {
    if (v > yMax) continue;
    svg.appendChild(el('line', { class: 'band', x1: ML, x2: W - MR, y1: py(v), y2: py(v) }));
    svg.appendChild(el('text', { class: 'lbl', x: W - MR, y: py(v) - 3, 'text-anchor': 'end' }, String(v)));
  }

  const slotW = (W - ML - MR) / cycles.length;
  const bw = Math.max(6, Math.min(26, slotW - 4));      // 2px di superficie fra le barre
  cycles.forEach((c, i) => {
    const cls = frequency(c.length);
    const out = cls !== 'normale';
    const x = px(i) + (slotW - bw) / 2;
    const y = py(c.length);
    svg.appendChild(el('rect', {
      class: 'bar' + (out ? ' out' : ''), x, y, width: bw,
      height: py(0) - y, rx: 4, ry: 4,
    }));
    // Etichetta diretta solo sulle barre fuori banda: il colore da solo non basta.
    if (out) svg.appendChild(el('text', { class: 'vlabel', x: x + bw / 2, y: y - 4, 'text-anchor': 'middle' }, String(c.length)));
    const hit = el('rect', { x: px(i), y: MT, width: slotW, height: H - MT - MB, fill: 'transparent' });
    const show = () => { readout.textContent = T.st.cycleReadout(i + 1, fullDate(c.start), c.length, T.freq[cls]); };
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerenter', show);
    svg.appendChild(hit);
  });

  svg.appendChild(el('line', { class: 'axis', x1: ML, x2: W - MR, y1: py(0), y2: py(0) }));
  svg.appendChild(el('text', { class: 'lbl', x: ML, y: H - 6 }, T.st.axisCycles));
  svg.appendChild(el('text', { class: 'lbl', x: W - MR, y: H - 6, 'text-anchor': 'end' }, T.st.axisDays));
  return svg;
}

/**
 * Linea: dolore medio in funzione del giorno rispetto all'inizio del ciclo.
 *
 * L'asse x è lungo quanto il ciclo più lungo, quindi non entra sempre nello
 * schermo. L'asse y resta fermo a sinistra; l'area del grafico scorre in
 * orizzontale con il dito (scroll nativo, niente gesti fatti a mano).
 * Restituisce un <div>, non un <svg>.
 */
function profileChart(points, readout) {
  const H = 176, MT = 14, MB = 18, YW = 24, RW = 30, PAD = 12;
  const DX = 11;                                // px per giorno: ~4 settimane visibili su un iPhone
  const x0 = points[0].offset, x1 = points[points.length - 1].offset;
  const PW = PAD * 2 + (x1 - x0) * DX;
  const px = (o) => PAD + (o - x0) * DX;
  const py = (v) => MT + (H - MT - MB) * (1 - v / 10);
  const pts = points.filter((p) => p.mean !== null);

  const wrap = document.createElement('div');
  wrap.className = 'chart-wrap';

  // -- asse y fisso
  const ax = el('svg', { class: 'chart yaxis', width: YW, height: H, viewBox: `0 0 ${YW} ${H}`, 'aria-hidden': 'true' });
  for (const t of [0, 5, 10]) {
    ax.appendChild(el('text', { class: 'tick', x: YW - 4, y: py(t) + 3, 'text-anchor': 'end' }, String(t)));
  }
  wrap.appendChild(ax);

  // -- legenda: due grandezze con scale diverse, quindi ognuna dice la sua
  const legend = document.createElement('div');
  legend.className = 'legend';
  legend.innerHTML = '<span><i class="lg-line"></i></span><span><i class="lg-bar"></i></span>';
  legend.children[0].append(T.st.legendPain);
  legend.children[1].append(T.st.legendBloating);

  // -- area scorrevole
  const scroller = document.createElement('div');
  scroller.className = 'chart-scroll';
  const svg = el('svg', { class: 'chart', width: PW, height: H, viewBox: `0 0 ${PW} ${H}`, role: 'img',
    'aria-label': T.st.profile });

  for (const t of [0, 5, 10]) {
    svg.appendChild(el('line', { class: 'gridline', x1: 0, x2: PW, y1: py(t), y2: py(t) }));
  }
  // Tacche ogni settimana, allineate all'inizio delle mestruazioni (…, -7, 0, 7, 14, …).
  for (let t = Math.ceil(x0 / 7) * 7; t <= x1; t += 7) {
    svg.appendChild(el('text', { class: 'tick', x: px(t), y: H - MB + 12, 'text-anchor': 'middle' }, String(t)));
  }
  svg.appendChild(el('line', { class: 'axis', x1: 0, x2: PW, y1: py(0), y2: py(0) }));
  svg.appendChild(el('line', { class: 'onset', x1: px(0), x2: px(0), y1: MT, y2: py(0) }));
  // etichetta in basso, dove non litiga con il picco della curva
  svg.appendChild(el('text', { class: 'lbl', x: px(0) + 3, y: py(0) - 4 }, T.st.onset));

  // Blähbauch: barre dietro la linea, 100 % = altezza piena (stessa altezza di 10/10).
  // Le barre stanno sotto la linea del dolore, così non la coprono.
  const bw = DX - 3;
  points.forEach((p) => {
    if (!p.bloatingPct) return;
    const y = py(p.bloatingPct / 10);
    svg.appendChild(el('rect', { class: 'bar2', x: px(p.offset) - bw / 2, y, width: bw, height: py(0) - y, rx: 2, ry: 2 }));
  });

  // La linea si interrompe dove mancano dati: unire due punti lontani
  // inventerebbe dei giorni che nessuno ha registrato.
  if (pts.length > 1) {
    let d = '', prev = null;
    for (const p of pts) {
      d += `${prev !== null && p.offset === prev + 1 ? 'L' : 'M'}${px(p.offset).toFixed(1)},${py(p.mean).toFixed(1)} `;
      prev = p.offset;
    }
    svg.appendChild(el('path', { class: 'series', d: d.trim() }));
  }
  // Punti isolati (senza vicini) altrimenti sarebbero invisibili.
  pts.forEach((p) => {
    const hasPrev = pts.some((q) => q.offset === p.offset - 1);
    const hasNext = pts.some((q) => q.offset === p.offset + 1);
    if (!hasPrev && !hasNext) svg.appendChild(el('circle', { class: 'marker', cx: px(p.offset), cy: py(p.mean), r: 2.5 }));
  });
  // Un solo marcatore evidente, sul picco.
  const peak = pts.length ? pts.reduce((a, b) => (b.mean > a.mean ? b : a), pts[0]) : null;
  if (peak) {
    svg.appendChild(el('circle', { class: 'marker', cx: px(peak.offset), cy: py(peak.mean), r: 4.5 }));
    svg.appendChild(el('text', {
      class: 'vlabel', x: px(peak.offset), y: py(peak.mean) - 9, 'text-anchor': 'middle',
    }, n1(peak.mean)));
  }

  // Bersaglio di tocco largo quanto una colonna. Solo 'click', non 'pointerdown':
  // così un dito che scorre il grafico non cambia la lettura a ogni passaggio.
  points.forEach((p) => {
    const hit = el('rect', { x: px(p.offset) - DX / 2, y: MT, width: DX, height: H - MT - MB, fill: 'transparent' });
    const show = () => {
      readout.textContent = p.mean === null
        ? T.st.profileNoData(p.offset)
        : T.st.profileReadout(p.offset, n1(p.mean), p.n, p.bloating);
    };
    hit.addEventListener('click', show);
    hit.addEventListener('mouseenter', show);
    svg.appendChild(hit);
  });

  scroller.appendChild(svg);
  wrap.appendChild(scroller);

  // -- asse destro fisso: percentuale dei cicli con Blähbauch
  const ax2 = el('svg', { class: 'chart yaxis', width: RW, height: H, viewBox: `0 0 ${RW} ${H}`, 'aria-hidden': 'true' });
  for (const t of [0, 50, 100]) {
    ax2.appendChild(el('text', { class: 'tick', x: 4, y: py(t / 10) + 3, 'text-anchor': 'start' }, `${t}%`));
  }
  wrap.appendChild(ax2);
  // Etichetta dell'asse fuori dall'area scorrevole, così non sparisce scorrendo.
  const out = document.createElement('div');
  out.appendChild(legend);
  const lbl = document.createElement('div');
  lbl.className = 'axislbl';
  lbl.textContent = T.st.axisProfile;
  out.appendChild(wrap);
  out.appendChild(lbl);
  return out;
}

/**
 * Linea nel tempo reale (calendario): dolore giorno per giorno, una linea rossa
 * a ogni inizio di ciclo, sfondo rosa sui giorni di mestruazioni, una tacca
 * arancione sotto l'asse nei giorni con Blähbauch. Scorre in orizzontale e
 * parte mostrando i giorni più recenti.
 */
function timelineChart(a, readout) {
  const H = 186, MT = 18, MB = 34, YW = 24, PAD = 10, DX = 8;
  const first = [a.logs[0].date, ...(a.cycles.length ? [a.cycles[0].start] : [])].sort()[0];
  const last = a.today > a.logs[a.logs.length - 1].date ? a.today : a.logs[a.logs.length - 1].date;
  const days = diffDays(first, last);
  const PW = PAD * 2 + days * DX;
  const px = (k) => PAD + diffDays(first, k) * DX;
  const py = (v) => MT + (H - MT - MB) * (1 - v / 10);
  const byDay = new Map(a.logs.map((l) => [l.date, l]));
  const cycleDay = (k) => {
    let c = null;
    for (const x of a.cycles) if (x.start <= k) c = x;
    return c ? diffDays(c.start, k) + 1 : null;
  };

  const out = document.createElement('div');
  const legend = document.createElement('div');
  legend.className = 'legend';
  legend.innerHTML = '<span><i class="lg-line"></i></span><span><i class="lg-start"></i></span><span><i class="lg-tick"></i></span>';
  legend.children[0].append(T.st.tlLegendPain);
  legend.children[1].append(T.st.tlLegendStart);
  legend.children[2].append(T.st.tlLegendBloat);
  out.appendChild(legend);

  const wrap = document.createElement('div');
  wrap.className = 'chart-wrap';
  const ax = el('svg', { class: 'chart yaxis', width: YW, height: H, viewBox: `0 0 ${YW} ${H}`, 'aria-hidden': 'true' });
  for (const t of [0, 5, 10]) {
    ax.appendChild(el('text', { class: 'tick', x: YW - 4, y: py(t) + 3, 'text-anchor': 'end' }, String(t)));
  }
  wrap.appendChild(ax);

  const scroller = document.createElement('div');
  scroller.className = 'chart-scroll';
  const svg = el('svg', { class: 'chart', width: PW, height: H, viewBox: `0 0 ${PW} ${H}`, role: 'img',
    'aria-label': T.st.tlTitle });

  // Sfondo dei giorni di mestruazioni (sotto a tutto il resto).
  for (const k of a.menstrualDays) {
    if (k < first || k > last) continue;
    svg.appendChild(el('rect', { class: 'mens', x: px(k) - DX / 2, y: MT, width: DX, height: py(0) - MT }));
  }
  for (const t of [0, 5, 10]) {
    svg.appendChild(el('line', { class: 'gridline', x1: 0, x2: PW, y1: py(t), y2: py(t) }));
  }
  // Mesi sull'asse x: una tacca al primo di ogni mese.
  for (let k = first; k <= last; k = addDays(k, 1)) {
    if (!k.endsWith('-01') && k !== first) continue;
    const d = fromKey(k);
    const lbl = T.monthsShort[d.getMonth()] + (d.getMonth() === 0 || k === first ? ` ${String(d.getFullYear()).slice(2)}` : '');
    svg.appendChild(el('line', { class: 'gridline', x1: px(k), x2: px(k), y1: py(0), y2: py(0) + 4 }));
    svg.appendChild(el('text', { class: 'tick', x: px(k) + 2, y: H - 6, 'text-anchor': 'start' }, lbl));
  }
  svg.appendChild(el('line', { class: 'axis', x1: 0, x2: PW, y1: py(0), y2: py(0) }));

  // Una linea rossa per ogni ciclo, con la data sopra.
  for (const c of a.cycles) {
    const d = fromKey(c.start);
    svg.appendChild(el('line', { class: 'onset', x1: px(c.start), x2: px(c.start), y1: MT - 4, y2: py(0) }));
    svg.appendChild(el('text', { class: 'lbl', x: px(c.start) + 3, y: MT - 7 }, `${d.getDate()}. ${T.monthsShort[d.getMonth()]}`));
  }

  // Blähbauch: tacca sotto l'asse, così non si confonde con la curva.
  for (const l of a.logs) {
    if (!l.symptoms.includes('bloating')) continue;
    svg.appendChild(el('rect', { class: 'bar2', x: px(l.date) - (DX - 2) / 2, y: py(0) + 5, width: DX - 2, height: 6, rx: 1.5, ry: 1.5 }));
  }

  // Curva del dolore, interrotta nei giorni senza registrazione.
  let d = '', prev = null;
  for (const l of a.logs) {
    d += `${prev !== null && diffDays(prev, l.date) === 1 ? 'L' : 'M'}${px(l.date).toFixed(1)},${py(l.pain).toFixed(1)} `;
    prev = l.date;
  }
  svg.appendChild(el('path', { class: 'series', d: d.trim() }));
  a.logs.forEach((l, i) => {
    const hasPrev = i > 0 && diffDays(a.logs[i - 1].date, l.date) === 1;
    const hasNext = i < a.logs.length - 1 && diffDays(l.date, a.logs[i + 1].date) === 1;
    if (!hasPrev && !hasNext) svg.appendChild(el('circle', { class: 'marker', cx: px(l.date), cy: py(l.pain), r: 2.5 }));
  });

  // Bersagli di tocco, uno per giorno.
  for (let k = first; k <= last; k = addDays(k, 1)) {
    const hit = el('rect', { x: px(k) - DX / 2, y: MT, width: DX, height: H - MT - MB + 12, fill: 'transparent' });
    const key = k;
    const show = () => {
      const l = byDay.get(key), cd = cycleDay(key);
      readout.textContent = l
        ? T.st.tlReadout(fullDate(key), cd, l.pain, l.symptoms.includes('bloating'))
        : T.st.tlNoData(fullDate(key), cd);
    };
    hit.addEventListener('click', show);
    hit.addEventListener('mouseenter', show);
    svg.appendChild(hit);
  }

  scroller.appendChild(svg);
  wrap.appendChild(scroller);
  out.appendChild(wrap);

  // Parte dai giorni più recenti. Le statistiche si disegnano anche a schermata
  // nascosta (larghezza 0), quindi si aspetta che il riquadro abbia una misura.
  const toEnd = () => { scroller.scrollLeft = scroller.scrollWidth; };
  if ('ResizeObserver' in window) {
    let done = false;
    const ro = new ResizeObserver(() => {
      if (!done && scroller.clientWidth > 0) { done = true; toEnd(); ro.disconnect(); }
    });
    ro.observe(scroller);
  } else {
    requestAnimationFrame(toEnd);
  }
  return out;
}

// =============================================================================
// 7. Statistiche
// =============================================================================

function card(title) {
  const c = document.createElement('div');
  c.className = 'card';
  if (title) { const h = document.createElement('h2'); h.textContent = title; c.appendChild(h); }
  return c;
}

function row(parent, label, value) {
  const r = document.createElement('div');
  r.className = 'row';
  const a = document.createElement('span');
  a.textContent = label;
  const b = document.createElement('span');
  b.className = 'v';
  b.textContent = value;
  r.appendChild(a); r.appendChild(b);
  parent.appendChild(r);
  return r;
}

function note(parent, text) {
  const p = document.createElement('p');
  p.className = 'note';
  p.textContent = text;
  parent.appendChild(p);
}

/**
 * Tabella richiudibile. Oltre `pageSize` righe si divide in pagine con
 * ‹ Seite i von n ›, così la scheda non diventa lunghissima.
 * `startPage`: 'first' | 'last' (per le liste in cui interessano gli ultimi giorni).
 */
function details(parent, headers, rows, label = T.st.seeNumbers, { pageSize = 14, startPage = 'first' } = {}) {
  const det = document.createElement('details');
  const sum = document.createElement('summary');
  sum.textContent = label;
  det.appendChild(sum);
  const t = document.createElement('table');
  t.className = 'data';
  const head = document.createElement('tr');
  headers.forEach((h) => { const th = document.createElement('th'); th.textContent = h; head.appendChild(th); });
  const body = document.createElement('tbody');
  const thead = document.createElement('thead');
  thead.appendChild(head);
  t.appendChild(thead);
  t.appendChild(body);
  det.appendChild(t);

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  let page = startPage === 'last' ? pages - 1 : 0;
  let nav = null, prev, next, info;

  const draw = () => {
    body.textContent = '';
    rows.slice(page * pageSize, (page + 1) * pageSize).forEach((cells) => {
      const tr2 = document.createElement('tr');
      cells.forEach((c) => { const td = document.createElement('td'); td.textContent = c; tr2.appendChild(td); });
      body.appendChild(tr2);
    });
    if (nav) {
      info.textContent = T.st.pageOf(page + 1, pages);
      prev.disabled = page === 0;
      next.disabled = page === pages - 1;
    }
  };

  if (pages > 1) {
    nav = document.createElement('div');
    nav.className = 'pager';
    prev = document.createElement('button');
    prev.type = 'button'; prev.textContent = '‹'; prev.setAttribute('aria-label', T.st.pagePrev);
    next = document.createElement('button');
    next.type = 'button'; next.textContent = '›'; next.setAttribute('aria-label', T.st.pageNext);
    info = document.createElement('span');
    info.setAttribute('aria-live', 'polite');
    prev.addEventListener('click', () => { if (page > 0) { page--; draw(); } });
    next.addEventListener('click', () => { if (page < pages - 1) { page++; draw(); } });
    nav.append(prev, info, next);
    det.appendChild(nav);
  }
  draw();
  parent.appendChild(det);
}

function renderStats() {
  const host = $('#stats');
  host.textContent = '';

  if (!logs.length) {
    const d = document.createElement('div');
    d.className = 'empty-state';
    d.textContent = T.st.empty;
    host.appendChild(d);
    return;
  }

  const a = analyse(logs);
  const s = a.summary;

  // -- copertura
  {
    const c = card(T.st.coverage);
    row(c, T.st.daysLogged, String(logs.length));
    if (a.completeness !== null) row(c, T.st.coveragePct, `${n0(a.completeness)} %`);
    if (a.completeness !== null && a.completeness < 80) note(c, T.st.coverageNote);
    host.appendChild(c);
  }

  // -- cicli
  {
    const c = card(T.st.cycles);
    row(c, T.st.completeCycles, String(s.closedCount));
    if (s.mean !== null) row(c, T.st.meanLength, `${n1(s.mean)} ${T.st.tblDays}`);
    if (s.sd !== null) row(c, T.st.sd, `${n1(s.sd)} ${T.st.tblDays}`);
    if (s.min !== null) row(c, T.st.minMax, `${s.min} – ${s.max} ${T.st.tblDays}`);
    if (s.variation !== null && s.closedCount >= 2) {
      const v = s.variation;
      row(c, T.st.regularity, v <= 7 ? T.st.regular(v) : v <= 9 ? T.st.regularYoung(v) : T.st.irregular(v));
    }
    if (s.closedCount === 0) note(c, T.st.noCycleYet);
    else if (s.closedCount < 3) note(c, T.st.fewCycles);
    host.appendChild(c);
  }

  // -- grafico dei cicli
  if (a.closed.length >= 2) {
    const c = card(T.st.cycleChart);
    const ro = document.createElement('div');
    ro.className = 'readout';
    c.appendChild(cycleChart(a.closed, ro));
    c.appendChild(ro);
    ro.textContent = T.st.tapBar;
    note(c, T.st.bandNote);
    details(c, [T.st.tblStart, T.st.tblDays, T.st.tblClass],
      a.closed.map((x) => [fullDate(x.start), String(x.length), T.freq[frequency(x.length)]]));
    host.appendChild(c);
  }

  // -- perdite
  {
    const c = card(T.st.menses);
    if (s.mensesMean !== null) row(c, T.st.meanDuration, `${n1(s.mensesMean)} ${T.st.tblDays}`);
    if (s.mensesMin !== null) row(c, T.st.minMax, `${s.mensesMin} – ${s.mensesMax} ${T.st.tblDays}`);
    row(c, T.st.prolonged, String(s.prolonged));
    if (s.prolonged > 0) note(c, T.st.prolongedNote);
    host.appendChild(c);
  }

  // -- dolore
  {
    const p = a.pain;
    const c = card(T.st.painTitle);
    if (p.meanDuring !== null) row(c, T.st.meanDuring, `${n1(p.meanDuring)} / 10`);
    if (p.meanOutside !== null) row(c, T.st.meanOutside, `${n1(p.meanOutside)} / 10`);
    if (p.pctOutsideModerate !== null) {
      row(c, T.st.pctOutside, T.st.ofDays(n0(p.pctOutsideModerate), p.outsideDays));
    }
    if (p.worst) row(c, T.st.worstDay, `${fullDate(p.worst.date)} — ${p.worst.pain}/10`);
    row(c, T.st.analgDays, String(p.analgesicDays));
    note(c, T.st.painNote);
    host.appendChild(c);
  }

  // -- dolore nel tempo (calendario), una linea per ogni inizio di ciclo
  {
    const c = card(T.st.tlTitle);
    const ro = document.createElement('div');
    ro.className = 'readout';
    c.appendChild(timelineChart(a, ro));
    c.appendChild(ro);
    ro.textContent = diffDays(a.logs[0].date, a.today) > 38 ? T.st.tlTap : T.st.tapChart;
    note(c, T.st.tlNote);
    host.appendChild(c);
  }

  // -- profilo del dolore
  if (a.profile.some((p) => p.mean !== null)) {
    const c = card(T.st.profile);
    const ro = document.createElement('div');
    ro.className = 'readout';
    const chart = profileChart(a.profile, ro);
    c.appendChild(chart);
    c.appendChild(ro);
    // Le statistiche si disegnano anche a schermata nascosta, dove la larghezza
    // vale 0: il suggerimento dipende quindi dalla lunghezza dell'asse (> 4 settimane).
    const span = a.profile[a.profile.length - 1].offset - a.profile[0].offset;
    ro.textContent = span > 28 ? T.st.tapChartSwipe : T.st.tapChart;
    note(c, T.st.profileNote);
    details(c, [T.st.tblDay, T.st.tblMeanPain, T.st.tblBloating, T.st.tblCycles],
      a.profile.filter((p) => p.mean !== null)
        .map((p) => [`${p.offset >= 0 ? '+' : ''}${p.offset}`, n1(p.mean), `${n0(p.bloatingPct)} %`, String(p.n)]),
      T.st.seeNumbers, { pageSize: 14 });
    host.appendChild(c);
  }

  // -- sintomi
  {
    const c = card(T.st.symptomsTitle);
    if (!a.symptomStats.length) {
      note(c, T.st.noSymptoms);
    } else {
      a.symptomStats.forEach((st) => {
        const d = document.createElement('div');
        d.className = 'symrow';

        const top = document.createElement('div');
        top.className = 'top';
        const nameEl = document.createElement('span');
        nameEl.textContent = st.label;
        const pctEl = document.createElement('span');
        pctEl.className = 'v';
        pctEl.textContent = `${n0(st.pct)} %`;
        top.appendChild(nameEl); top.appendChild(pctEl);
        d.appendChild(top);

        const sub = document.createElement('div');
        sub.className = 'sub';
        if (st.pctDuring !== null && st.pctOutside !== null) {
          sub.appendChild(document.createTextNode(T.st.symptomSplit(n0(st.pctDuring), n0(st.pctOutside))));
        }
        if (st.painDelta !== null) {
          if (sub.textContent) sub.appendChild(document.createTextNode(' · '));
          const dl = document.createElement('span');
          dl.className = 'delta' + (st.painDelta >= 1 ? ' hi' : '');
          dl.textContent = T.st.symptomDelta(st.painDelta >= 0 ? '+' : '−',
            Math.abs(st.painDelta).toFixed(1).replace('.', ','));
          sub.appendChild(dl);
        }
        d.appendChild(sub);
        c.appendChild(d);
      });
      note(c, T.st.symptomNote);
    }
    host.appendChild(c);
  }

  // -- sonno
  {
    const sl = a.sleep;
    const c = card(T.st.sleepTitle);
    if (!sl.nights) {
      note(c, T.st.sleepNone);
    } else {
      row(c, T.st.sleepNights, String(sl.nights));
      if (sl.meanPainAfterGood !== null || sl.meanPainAfterBad !== null) {
        row(c, T.st.sleepGoodVsBad, `${n1(sl.meanPainAfterGood)} / ${n1(sl.meanPainAfterBad)}`);
      }
      if (sl.mensNightsLogged) row(c, T.st.sleepDuringMenses, `${sl.badDuringMenses} / ${sl.mensNightsLogged}`);
      if (sl.outsideNightsLogged) row(c, T.st.sleepOutside, `${sl.badOutside} / ${sl.outsideNightsLogged}`);
      details(c, [T.st.sleepCol, T.st.sleepColNights, T.st.sleepColSame, T.st.sleepColNext],
        sl.byLevel.filter((x) => x.nights > 0).map((x) => [
          T.sleep[x.level], String(x.nights), n1(x.meanPainSameDay), n1(x.meanPainNextDay),
        ]));
      note(c, T.st.sleepNote);
    }
    host.appendChild(c);
  }

  // -- spotting
  if (a.spottingOnly.length) {
    const c = card(T.st.spotting);
    a.spottingOnly.forEach((e) => row(c, fullDate(e.start), e.span === 1 ? T.st.oneDay : T.st.nDays(e.span)));
    note(c, T.st.spottingNote);
    host.appendChild(c);
  }
}

// =============================================================================
// 8. Esportazione
// =============================================================================

function renderExport() {
  const i = $('#exportinfo');
  i.textContent = '';
  row(i, T.st.daysLogged, String(logs.length));
  if (logs.length) {
    row(i, T.ex.from, fullDate(logs[0].date));
    row(i, T.ex.to, fullDate(logs[logs.length - 1].date));
  }
  const since = daysSinceBackup();
  row(i, T.ex.lastBackup, lastBackup
    ? `${fullDate(toKey(new Date(lastBackup)))} (${since === 0 ? T.ex.today : T.ex.daysAgo(since)})`
    : T.ex.never);

  // Elenco completo di quello che c'è sul telefono. iOS non offre nessun modo
  // di sfogliare questo archivio dalle impostazioni, quindi lo mostra l'app.
  if (logs.length) {
    details(i, [T.ex.colDate, T.ex.colPain, T.ex.colFlow, T.ex.colExtra],
      [...logs].reverse().map((l) => {
        const extra = [];
        if (l.symptoms.length) extra.push(`${l.symptoms.length} ×`);
        if (l.analgesic) extra.push('Rx');
        if (l.note) extra.push('✎');
        return [fullDate(l.date), `${l.pain}`, T.flow[l.flow], extra.join(' ') || '—'];
      }), T.ex.allEntries);
    note(i, T.ex.entriesNote);
  } else {
    note(i, T.ex.noEntries);
  }
  $('#version').textContent = `${T.appName} ${APP_VERSION}`;
  updateStorageInfo();
}

async function updateStorageInfo() {
  const box = $('#storageinfo');
  box.textContent = '';
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  row(box, T.ex.standalone, standalone ? T.ex.yes : T.ex.noSeeBelow);
  if (navigator.storage && navigator.storage.persisted) {
    const p = await navigator.storage.persisted();
    row(box, T.ex.persisted, p ? T.ex.yes : T.ex.notGranted);
  }
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const e = await navigator.storage.estimate();
      if (e.usage != null) row(box, T.ex.used, `${(e.usage / 1024).toFixed(0)} kB`);
    } catch { /* non disponibile ovunque */ }
  }
  if (!standalone) note(box, T.ex.addToHome);
}

function csvEscape(s) {
  s = String(s ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function buildCSV() {
  const a = analyse(logs);
  const C = T.csv;
  const head = [C.date, C.painNrs, C.painBand, C.flow, C.isMenses, C.cycleDay,
    C.sleep, C.analgesic, C.analgesicNote, ...SYMPTOMS.map((s) => s.csv), C.note];
  const lines = [head.join(',')];

  for (const l of a.logs) {
    let cycleDay = '';
    for (const c of a.cycles) {
      if (c.start <= l.date && (!c.closed || l.date <= c.end)) cycleDay = String(diffDays(c.start, l.date) + 1);
    }
    lines.push([
      l.date, l.pain, painLabel(l.pain), T.flow[l.flow],
      a.menstrualDays.has(l.date) ? 1 : 0, cycleDay,
      (l.sleep === null || l.sleep === undefined) ? '' : T.sleep[l.sleep],
      l.analgesic ? 1 : 0, csvEscape(l.analgesicNote),
      ...SYMPTOMS.map((s) => (l.symptoms.includes(s.key) ? 1 : 0)),
      csvEscape(l.note),
    ].join(','));
  }
  return lines.join('\n');
}

function buildSummary() {
  const a = analyse(logs);
  const s = a.summary, p = a.pain, S = T.sum;
  let t = S.title + '\n';
  if (logs.length) t += S.period(fullDate(logs[0].date), fullDate(logs[logs.length - 1].date)) + '\n';
  t += S.daysLogged(logs.length);
  if (a.completeness !== null) t += S.coverage(n0(a.completeness));
  t += '\n\n' + S.cycles + '\n';
  t += S.completeCycles(s.closedCount) + '\n';
  if (s.mean !== null) t += S.mean(n1(s.mean)) + '\n';
  if (s.sd !== null) t += S.sd(n1(s.sd)) + '\n';
  if (s.min !== null) t += S.minmax(s.min, s.max) + '\n';
  if (s.variation !== null && s.closedCount >= 2) {
    const v = s.variation;
    t += S.regularity(v <= 7 ? T.st.regular(v) : v <= 9 ? T.st.regularYoung(v) : T.st.irregular(v)) + '\n';
  }
  if (a.closed.length) {
    t += S.single + a.closed.map((c) => `${fullDate(c.start)} → ${c.length}d`).join(', ') + '\n';
  }

  t += '\n' + S.menses + '\n';
  if (s.mensesMean !== null) t += S.mean(n1(s.mensesMean)) + '\n';
  if (s.mensesMin !== null) t += S.minmax(s.mensesMin, s.mensesMax) + '\n';
  t += S.prolonged(s.prolonged) + '\n';
  if (a.spottingOnly.length) t += S.spotting(a.spottingOnly.length) + '\n';

  t += '\n' + S.pain + '\n';
  if (p.meanDuring !== null) t += S.during(n1(p.meanDuring)) + '\n';
  if (p.meanOutside !== null) t += S.outside(n1(p.meanOutside)) + '\n';
  if (p.pctOutsideModerate !== null) t += S.pctOutside(n0(p.pctOutsideModerate), p.outsideDays) + '\n';
  if (p.worst) t += S.worst(fullDate(p.worst.date), p.worst.pain) + '\n';
  t += S.analg(p.analgesicDays) + '\n';

  t += '\n' + S.symptoms + '\n';
  for (const st of a.symptomStats) {
    t += `- ${st.label}: ${n0(st.pct)} %`;
    if (st.pctDuring !== null) t += S.symptomLine(n0(st.pctDuring), n0(st.pctOutside));
    t += '\n';
  }

  if (a.sleep.nights) {
    t += '\n' + T.st.sleepTitle.toUpperCase() + '\n';
    t += `${T.st.sleepNights}: ${a.sleep.nights}\n`;
    for (const x of a.sleep.byLevel) {
      if (!x.nights) continue;
      t += `- ${T.sleep[x.level]}: ${x.nights} (${T.st.sleepColSame} ${n1(x.meanPainSameDay)}, ${T.st.sleepColNext} ${n1(x.meanPainNextDay)})\n`;
    }
    t += `${T.st.sleepGoodVsBad}: ${n1(a.sleep.meanPainAfterGood)} / ${n1(a.sleep.meanPainAfterBad)}\n`;
  }

  t += '\n' + S.profile + '\n' + S.profileHead + '\n';
  for (const pt of a.profile) {
    if (pt.mean === null) continue;
    t += `${pt.offset >= 0 ? '+' : ''}${pt.offset}: ${n1(pt.mean)} (n=${pt.n}, ${T.st.tblBloating} ${pt.bloating}/${pt.n})\n`;
  }

  t += '\n' + S.defs + '\n';
  return t;
}

/**
 * Su iPhone il foglio di condivisione è molto più affidabile di un download,
 * quindi si prova prima quello. Il download resta come riserva.
 */
async function deliver(text, filename, mime) {
  try {
    const file = new File([text], filename, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return true;
    }
  } catch (e) {
    // Annullato dall'utente: non è un errore, ma non è nemmeno un backup fatto.
    if (e && e.name === 'AbortError') return false;
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

// =============================================================================
// 9. Dati di esempio
// =============================================================================

async function loadSample() {
  const today = todayKey();
  const lengths = [29, 26, 33, 28];
  let start = addDays(today, -(lengths.reduce((a, b) => a + b, 0) + 12));

  const emit = async (startKey, length, heavy) => {
    const flows = heavy ? [2, 3, 3, 2, 2, 1] : [2, 3, 2, 1];
    const pains = heavy ? [6, 9, 8, 6, 4, 2] : [5, 7, 5, 3];
    for (let o = 0; o < length; o++) {
      const date = addDays(startKey, o);
      if (date > today) return;
      const flow = o < flows.length ? flows[o] : 0;
      let pain = o < pains.length ? pains[o] : 0;
      const symptoms = [];
      if (o < flows.length) {
        symptoms.push('bloating', 'fatigue');
        if (heavy) symptoms.push('dyschezia', 'nausea');
      }
      if (o === Math.floor(length / 2) || o === Math.floor(length / 2) + 1) {
        pain = 4;
        if (!symptoms.includes('bloating')) symptoms.push('bloating');
      }
      if (pain === 0 && o % 3 === 0) pain = 2;
      // Notti peggiori nei giorni di flusso, buone il resto del tempo.
      const sleep = o < flows.length ? (heavy ? 3 : 2) : (o % 4 === 0 ? 1 : 0);
      await put({
        date, pain, flow, sleep, symptoms,
        analgesic: pain >= 6,
        analgesicNote: pain >= 6 ? 'Ibuprofen 400' : '',
        note: '', updated: new Date().toISOString(),
      });
    }
  };

  for (let i = 0; i < lengths.length; i++) {
    await emit(start, lengths[i], i % 2 === 0);
    start = addDays(start, lengths[i]);
  }
  await emit(start, 12, false);
}

// =============================================================================
// 10. Avvio
// =============================================================================

function showView(name) {
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  $$('#tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  window.scrollTo(0, 0);
}

async function refreshAll() {
  await reload();
  renderCalendar();
  renderStats();
  renderExport();
}

function wireEvents() {
  $$('#tabbar button').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));

  $('#prevmonth').addEventListener('click', () => {
    const [y, m] = anchor.split('-').map(Number);
    anchor = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`;
    renderCalendar();
  });
  $('#nextmonth').addEventListener('click', () => {
    const [y, m] = anchor.split('-').map(Number);
    anchor = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    renderCalendar();
  });
  $('#btn-today').addEventListener('click', () => { anchor = todayKey(); renderCalendar(); openEditor(todayKey()); });

  $('#sheet-cancel').addEventListener('click', closeEditor);
  $('#sheet-save').addEventListener('click', saveEditor);
  $('#chk-precise').addEventListener('change', syncSheet);
  $('#rng-pain').addEventListener('input', (e) => { draft.pain = Number(e.target.value); syncSheet(); });
  $('#chk-analg').addEventListener('change', (e) => { draft.analgesic = e.target.checked; syncSheet(); });
  $('#btn-delete').addEventListener('click', async () => {
    if (!confirm(T.ed.confirmDelete)) return;
    await del(editing);
    closeEditor();
    await refreshAll();
  });

  $('#btn-csv').addEventListener('click', () => deliver(buildCSV(), `zyklus-${stamp()}.csv`, 'text/csv'));
  $('#btn-summary').addEventListener('click', () => deliver(buildSummary(), `zusammenfassung-${stamp()}.txt`, 'text/plain'));
  $('#btn-json').addEventListener('click', async () => {
    const ok = await deliver(
      JSON.stringify({ app: 'zyklus', version: APP_VERSION, exported: new Date().toISOString(), days: logs }, null, 1),
      `backup-zyklus-${stamp()}.json`, 'application/json');
    // Solo un backup andato a buon fine azzera il promemoria. Se lei annulla
    // il foglio di condivisione, il conteggio continua a correre.
    if (ok) {
      await setMeta('lastBackup', new Date().toISOString());
      await refreshAll();
    }
  });

  $('#btn-import').addEventListener('click', () => $('#file-import').click());
  $('#file-import').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const days = Array.isArray(data) ? data : data.days;
      if (!Array.isArray(days)) throw new Error(T.ex.badFormat);
      if (!confirm(T.ex.confirmImport(days.length))) return;
      for (const d of days) {
        if (!d || typeof d.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) continue;
        await put({
          date: d.date,
          pain: Math.max(0, Math.min(10, Number(d.pain) || 0)),
          flow: Math.max(0, Math.min(3, Number(d.flow) || 0)),
          symptoms: Array.isArray(d.symptoms) ? d.symptoms.filter((k) => SYMPTOMS.some((s) => s.key === k)) : [],
          // I backup vecchi portano la spunta del sonno fra i sintomi.
          sleep: (d.sleep === null || d.sleep === undefined)
            ? (Array.isArray(d.symptoms) && d.symptoms.includes('poor_sleep') ? 2 : null)
            : Math.max(0, Math.min(3, Number(d.sleep))),
          analgesic: !!d.analgesic,
          analgesicNote: String(d.analgesicNote || ''),
          note: String(d.note || ''),
          updated: d.updated || new Date().toISOString(),
        });
      }
      await refreshAll();
      alert(T.ex.importDone);
    } catch (err) {
      alert(T.ex.importFailed(err.message));
    } finally {
      e.target.value = '';
    }
  });

  $('#btn-sample').addEventListener('click', async () => {
    if (!confirm(T.ex.confirmSample)) return;
    await loadSample();
    await refreshAll();
    showView('stats');
  });
  $('#btn-wipe').addEventListener('click', async () => {
    if (!confirm(T.ex.confirmWipe1)) return;
    if (!confirm(T.ex.confirmWipe2)) return;
    await clearAll();
    await refreshAll();
  });
}

async function main() {
  applyStrings();
  db = await openDB();
  // Chiede a iOS di non buttare via i dati quando lo spazio scarseggia.
  // Su Safari viene concesso in base a euristiche, fra cui l'essere
  // stata aggiunta alla schermata Home.
  if (navigator.storage && navigator.storage.persist) {
    try { await navigator.storage.persist(); } catch { /* ignorabile */ }
  }
  buildSegments();
  wireEvents();
  await reload();
  await migrateSleep();
  await refreshAll();

  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js'); } catch { /* offline non disponibile */ }
  }
}

main().catch((e) => {
  document.body.textContent = 'Fehler beim Start: ' + e.message;
});
