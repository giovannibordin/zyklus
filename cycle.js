// =============================================================================
// cycle.js — tutta la matematica dei cicli. Nessun DOM, nessuna dipendenza.
//
// Le date sono SEMPRE stringhe "YYYY-MM-DD". Non si usano oggetti Date come
// chiavi: l'ora legale sposterebbe la mezzanotte e i giorni si
// accavallerebbero. L'aritmetica passa da UTC, dove il giorno dura sempre
// 86400 secondi.
//
// Definizioni implementate (fonti in DESIGN.md):
//
//  * Episodio di sanguinamento — uno o più giorni consecutivi con sangue o
//    spotting, delimitati da DUE giorni completamente asciutti. Un solo giorno
//    asciutto dentro le mestruazioni non le spezza in due.
//
//  * Episodio mestruale — un episodio che contiene almeno un giorno di vero
//    sanguinamento (flusso >= 2). Una serie di solo spotting è spotting
//    intermestruale e non apre mai un ciclo.
//
//  * Durata del ciclo (FIGO) — dal primo giorno di mestruazioni al primo
//    giorno delle successive. Banda normale 24–38 giorni.
//
//  * Durata delle perdite — giorni consecutivi di sanguinamento, spotting
//    incluso. Normale fino a 8 giorni.
// =============================================================================

import { T } from './strings.js';

export const FLOW = { NONE: 0, SPOTTING: 1, NORMAL: 2, HEAVY: 3 };

/** Werte, die die vier Schmerzknöpfe schreiben: die Mitte jeder NRS-Stufe. */
export const PAIN_BAND_VALUES = [0, 2, 5, 8];

/** Fascia standard: lieve 1–3, medio 4–6, forte 7–10. */
export function painBand(nrs) {
  if (nrs <= 0) return 0;
  if (nrs <= 3) return 1;
  if (nrs <= 6) return 2;
  return 3;
}

/** Nur die Schlüssel. Die Beschriftungen stehen in strings.js. */
export const SYMPTOMS = T.symptoms;

// -- Aritmetica sulle date -----------------------------------------------------

/** Date -> "YYYY-MM-DD" usando i componenti LOCALI (il giorno che vede lei). */
export function toKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" -> Date locale a mezzogiorno, così nessun fuso la sposta di un giorno. */
export function fromKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function todayKey() {
  return toKey(new Date());
}

/** Somma n giorni a una chiave. Passa per UTC: lì il giorno è sempre 86400 s. */
export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) + n * 86400000;
  const dt = new Date(t);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** Giorni interi da a a b (negativo se b precede a). */
export function diffDays(a, b) {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}

// -- Episodi -------------------------------------------------------------------

/**
 * @param {Array<{date:string, flow:number, pain:number, symptoms:string[], analgesic:boolean}>} logs
 * @returns {Array<{start:string, end:string, span:number, bleedingDays:number, maxFlow:number, isMenstrual:boolean}>}
 */
export function buildEpisodes(logs) {
  const blood = logs
    .filter((l) => l.flow >= FLOW.SPOTTING)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (blood.length === 0) return [];

  const groups = [];
  let current = [blood[0]];

  for (let i = 1; i < blood.length; i++) {
    const dryBetween = diffDays(blood[i - 1].date, blood[i].date) - 1;
    if (dryBetween >= 2) {
      groups.push(current);
      current = [blood[i]];
    } else {
      current.push(blood[i]);
    }
  }
  groups.push(current);

  return groups.map((g) => {
    const start = g[0].date;
    const end = g[g.length - 1].date;
    return {
      start,
      end,
      span: diffDays(start, end) + 1,
      bleedingDays: g.length,
      maxFlow: Math.max(...g.map((x) => x.flow)),
      isMenstrual: g.some((x) => x.flow >= FLOW.NORMAL),
    };
  });
}

// -- Cicli ---------------------------------------------------------------------

export function buildCycles(episodes) {
  const mens = episodes.filter((e) => e.isMenstrual);
  return mens.map((e, i) => {
    const closed = i + 1 < mens.length;
    const end = closed ? addDays(mens[i + 1].start, -1) : null;
    return {
      start: e.start,
      end,
      closed,
      menses: e,
      length: closed ? diffDays(e.start, end) + 1 : null,
    };
  });
}

/** Classificazione FIGO della frequenza. */
export function frequency(length) {
  if (length < 24) return 'frequente';
  if (length > 38) return 'infrequente';
  return 'normale';
}

// -- Analisi completa ----------------------------------------------------------

export function analyse(logs, today = todayKey()) {
  const sorted = [...logs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const episodes = buildEpisodes(sorted);
  const cycles = buildCycles(episodes);
  const closed = cycles.filter((c) => c.closed);
  const lengths = closed.map((c) => c.length);

  // Insieme di tutti i giorni che cadono dentro un episodio mestruale.
  const menstrualDays = new Set();
  for (const e of episodes) {
    if (!e.isMenstrual) continue;
    for (let d = e.start; d <= e.end; d = addDays(d, 1)) menstrualDays.add(d);
  }

  // --- Statistiche sui cicli
  const summary = {
    closedCount: closed.length,
    lengths,
    mean: null, sd: null, min: null, max: null, variation: null,
    mensesMean: null, mensesMin: null, mensesMax: null, prolonged: 0,
    regularity: null,
  };

  if (lengths.length) {
    const n = lengths.length;
    const mean = lengths.reduce((a, b) => a + b, 0) / n;
    summary.mean = mean;
    summary.min = Math.min(...lengths);
    summary.max = Math.max(...lengths);
    summary.variation = summary.max - summary.min;
    if (n > 1) {
      const ss = lengths.reduce((a, b) => a + (b - mean) ** 2, 0);
      summary.sd = Math.sqrt(ss / (n - 1));
    }
    if (n >= 2) {
      const v = summary.variation;
      summary.regularity =
        v <= 7 ? `Regolare (variazione ${v} giorni)`
        : v <= 9 ? `Regolare sotto i 26 anni (variazione ${v} giorni)`
        : `Irregolare (variazione ${v} giorni)`;
    }
  }

  const spans = episodes.filter((e) => e.isMenstrual).map((e) => e.span);
  if (spans.length) {
    summary.mensesMean = spans.reduce((a, b) => a + b, 0) / spans.length;
    summary.mensesMin = Math.min(...spans);
    summary.mensesMax = Math.max(...spans);
    summary.prolonged = spans.filter((s) => s > 8).length;
  }

  // --- Dolore dentro e fuori dalle mestruazioni
  const during = [], outside = [];
  for (const l of sorted) {
    (menstrualDays.has(l.date) ? during : outside).push(l.pain);
  }
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  let worst = null;
  for (const l of sorted) if (l.pain > 0 && (!worst || l.pain > worst.pain)) worst = l;

  const pain = {
    meanDuring: avg(during),
    meanOutside: avg(outside),
    outsideDays: outside.length,
    pctOutsideModerate: outside.length
      ? (100 * outside.filter((p) => p >= 4).length) / outside.length
      : null,
    worst,
    analgesicDays: sorted.filter((l) => l.analgesic).length,
  };

  // --- Profilo del dolore allineato all'inizio delle mestruazioni
  const painByDay = new Map(sorted.map((l) => [l.date, l.pain]));
  const logByDay = new Map(sorted.map((l) => [l.date, l]));
  // L'asse arriva fino all'ultimo giorno del ciclo più lungo (e fino a oggi per
  // quello aperto): prima era fisso a +20 e tutto ciò che seguiva spariva.
  // Minimo +20 perché il grafico abbia sempre una forma leggibile; tetto a 120
  // perché una lacuna di mesi nei dati non produca un asse lunghissimo e vuoto.
  let lastOffset = 20;
  for (const c of cycles) {
    const last = c.closed ? c.length - 1 : diffDays(c.start, today);
    if (last > lastOffset) lastOffset = last;
  }
  lastOffset = Math.min(lastOffset, 120);
  const profile = [];
  for (let k = -7; k <= lastOffset; k++) {
    const vals = [];
    let bloating = 0;
    for (const c of cycles) {
      const d = addDays(c.start, k);
      if (c.closed && d > c.end) continue;   // non sconfinare nel ciclo successivo
      if (d > today) continue;
      const l = logByDay.get(d);
      if (!l) continue;
      vals.push(l.pain);
      if (l.symptoms.includes('bloating')) bloating++;
    }
    // Blähbauch è un sì/no: la grandezza sensata è la quota di cicli in cui
    // quel giorno c'era, sullo stesso denominatore del dolore (giorni registrati).
    profile.push({
      offset: k,
      mean: vals.length ? avg(vals) : null,
      n: vals.length,
      bloating,
      bloatingPct: vals.length ? (100 * bloating) / vals.length : null,
    });
  }

  // --- Sintomi
  const mensLogs = sorted.filter((l) => menstrualDays.has(l.date));
  const outLogs = sorted.filter((l) => !menstrualDays.has(l.date));
  const symptomStats = SYMPTOMS.map((s) => {
    const present = sorted.filter((l) => l.symptoms.includes(s.key));
    const absent = sorted.filter((l) => !l.symptoms.includes(s.key));
    const mp = avg(present.map((l) => l.pain));
    const ma = avg(absent.map((l) => l.pain));
    return {
      key: s.key,
      label: s.label,
      days: present.length,
      pct: sorted.length ? (100 * present.length) / sorted.length : 0,
      pctDuring: mensLogs.length
        ? (100 * mensLogs.filter((l) => l.symptoms.includes(s.key)).length) / mensLogs.length
        : null,
      pctOutside: outLogs.length
        ? (100 * outLogs.filter((l) => l.symptoms.includes(s.key)).length) / outLogs.length
        : null,
      painDelta: mp !== null && ma !== null ? mp - ma : null,
    };
  })
    .filter((s) => s.days > 0)
    .sort((a, b) => (b.painDelta ?? -99) - (a.painDelta ?? -99));

  // --- Sonno
  // Due letture per ogni livello: il dolore dello stesso giorno e quello del
  // giorno dopo. La seconda è quella interessante — chiede se una brutta notte
  // precede una brutta giornata — ma resta una descrizione, non un nesso.
  const sleepLogs = sorted.filter((l) => l.sleep !== null && l.sleep !== undefined);
  const sleepByLevel = [0, 1, 2, 3].map((lvl) => {
    const nights = sleepLogs.filter((l) => l.sleep === lvl);
    const nextPains = [];
    for (const l of nights) {
      const nxt = painByDay.get(addDays(l.date, 1));
      if (nxt !== undefined) nextPains.push(nxt);
    }
    return {
      level: lvl,
      nights: nights.length,
      meanPainSameDay: avg(nights.map((l) => l.pain)),
      meanPainNextDay: nextPains.length ? avg(nextPains) : null,
    };
  });

  const goodNights = sleepLogs.filter((l) => l.sleep <= 1);
  const badNights = sleepLogs.filter((l) => l.sleep >= 2);
  const nextAfter = (arr) => {
    const v = [];
    for (const l of arr) {
      const nxt = painByDay.get(addDays(l.date, 1));
      if (nxt !== undefined) v.push(nxt);
    }
    return v.length ? avg(v) : null;
  };
  const sleep = {
    nights: sleepLogs.length,
    byLevel: sleepByLevel,
    meanPainAfterGood: nextAfter(goodNights),
    meanPainAfterBad: nextAfter(badNights),
    badDuringMenses: mensLogs.filter((l) => l.sleep >= 2).length,
    badOutside: outLogs.filter((l) => l.sleep >= 2).length,
    mensNightsLogged: mensLogs.filter((l) => l.sleep !== null && l.sleep !== undefined).length,
    outsideNightsLogged: outLogs.filter((l) => l.sleep !== null && l.sleep !== undefined).length,
  };

  // --- Qualità dei dati
  let completeness = null;
  if (sorted.length) {
    const span = diffDays(sorted[0].date, sorted[sorted.length - 1].date) + 1;
    if (span > 0) completeness = (100 * sorted.length) / span;
  }

  // --- Ciclo aperto e previsione
  const open = cycles.length && !cycles[cycles.length - 1].closed
    ? cycles[cycles.length - 1] : null;
  let predictedNext = null;
  if (open && lengths.length >= 3) {
    // Mediana, non media: un singolo ciclo da 60 giorni non deve trascinare la stima.
    const recent = lengths.slice(-6).sort((a, b) => a - b);
    const mid = recent.length % 2 === 1
      ? recent[(recent.length - 1) / 2]
      : Math.round((recent[recent.length / 2 - 1] + recent[recent.length / 2]) / 2);
    predictedNext = addDays(open.start, mid);
  }

  return {
    logs: sorted, episodes, cycles, closed, summary, pain, profile,
    symptomStats, sleep, completeness, menstrualDays,
    spottingOnly: episodes.filter((e) => !e.isMenstrual),
    open,
    openDay: open ? diffDays(open.start, today) + 1 : null,
    predictedNext,
    today,
  };
}
