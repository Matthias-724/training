// Datenhaltung der App.
//
// Beim Start wird alles aus IndexedDB in den Speicher geladen. Die Datenmenge
// ist klein (einige hundert Trainings), und synchrone Lesezugriffe halten die
// Ansichten einfach. Jede Änderung geht zuerst in den Speicher und wird dann
// geschrieben. Schreibfehler landen beim Fehler-Handler der App.

import * as db from './db.js';
import { buildSeed, mergeSeedUpdate, SEED_VERSION, DEFAULT_TABU, TABU_V1, CATEGORIES } from './seed.js';

const state = {
  exercises: new Map(),
  units: new Map(),
  phases: new Map(),
  trainings: [],
  cardio: [],
  kneeChecks: [],
  clearances: [],
  measurements: [],
  meta: {},
};

let checkIndex = new Map();
let onError = (err) => console.error(err);

export function setErrorHandler(fn) {
  onError = fn;
}

/** Schreibt im Hintergrund. Liefert true oder false, wirft nie. */
function persist(promise) {
  return promise.then(() => true, (err) => {
    onError(err);
    return false;
  });
}

export function uid(prefix) {
  const rand = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${rand}`;
}

// ---------------------------------------------------------------- Laden

export async function init() {
  const all = await Promise.all(db.STORES.map((s) => db.getAll(s)));
  const byName = Object.fromEntries(db.STORES.map((s, i) => [s, all[i]]));
  state.exercises = new Map(byName.exercises.map((x) => [x.id, x]));
  state.units = new Map(byName.units.map((x) => [x.id, x]));
  state.phases = new Map(byName.phases.map((x) => [x.id, x]));
  state.trainings = byName.trainings;
  state.cardio = byName.cardio;
  state.kneeChecks = byName.kneeChecks;
  state.clearances = byName.clearances;
  state.measurements = byName.measurements;
  state.meta = Object.fromEntries(byName.meta.map((m) => [m.key, m.value]));
  if (!state.meta.seedVersion) await installSeed();
  sortAll();
}

async function installSeed() {
  const seed = buildSeed();
  const meta = {
    seedVersion: SEED_VERSION,
    activePhaseId: 'p1',
    examMode: false,
    tabu: [...DEFAULT_TABU],
    installedAt: state.meta.installedAt ?? Date.now(),
    lastBackupAt: state.meta.lastBackupAt ?? null,
  };
  await db.replaceStores({ exercises: seed.exercises, units: seed.units, phases: seed.phases });
  await db.putMany('meta', Object.entries(meta).map(([key, value]) => ({ key, value })));
  state.exercises = new Map(seed.exercises.map((x) => [x.id, x]));
  state.units = new Map(seed.units.map((x) => [x.id, x]));
  state.phases = new Map(seed.phases.map((x) => [x.id, x]));
  Object.assign(state.meta, meta);
}

function byNewest(a, b) {
  return b.date.localeCompare(a.date) || (b.startedAt ?? 0) - (a.startedAt ?? 0);
}

function sortAll() {
  state.trainings.sort(byNewest);
  state.cardio.sort(byNewest);
  state.kneeChecks.sort(byNewest);
  state.clearances.sort(byNewest);
  state.measurements.sort(byNewest);
  checkIndex = new Map(state.kneeChecks.map((c) => [c.refDate, c]));
}

// ---------------------------------------------------------------- Meta

export function meta(key, fallback = null) {
  return state.meta[key] ?? fallback;
}

export function setMeta(key, value) {
  state.meta[key] = value;
  return persist(value === null || value === undefined ? db.remove('meta', key) : db.put('meta', { key, value }));
}

// ---------------------------------------------------------------- Übungen

const CATEGORY_ORDER = Object.keys(CATEGORIES);

export function exercise(id) {
  return state.exercises.get(id) ?? null;
}

export function allExercises() {
  return [...state.exercises.values()].sort((a, b) =>
    CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.name.localeCompare(b.name, 'de'));
}

export function newExercise(partial = {}) {
  return {
    id: uid('ex'), name: '', category: 'oberkoerper', sets: 3, mode: 'reps', min: 10, max: 12,
    perSide: false, weighted: true, assisted: false, restSec: 90, hint: '', kneeCheck: false,
    paused: false, pausedSince: null, pausedReason: null, alternatives: [], ...partial,
  };
}

export function saveExercise(ex) {
  state.exercises.set(ex.id, ex);
  return persist(db.put('exercises', ex));
}

/** Löscht die Übung aus Bibliothek, Einheiten und Ersatzlisten. Der Verlauf bleibt. */
export function deleteExercise(id) {
  state.exercises.delete(id);
  const changedUnits = [];
  for (const u of state.units.values()) {
    if (u.exerciseIds.includes(id)) {
      u.exerciseIds = u.exerciseIds.filter((x) => x !== id);
      changedUnits.push(u);
    }
  }
  const changedEx = [];
  for (const e of state.exercises.values()) {
    if (e.alternatives.includes(id)) {
      e.alternatives = e.alternatives.filter((x) => x !== id);
      changedEx.push(e);
    }
  }
  return persist(Promise.all([
    db.remove('exercises', id),
    db.putMany('units', changedUnits),
    db.putMany('exercises', changedEx),
  ]));
}

export function unitsUsing(exerciseId) {
  return [...state.units.values()].filter((u) => u.exerciseIds.includes(exerciseId));
}

/** Übungen, die diese Übung als Ersatz führen. */
export function alternativeOf(exerciseId) {
  return [...state.exercises.values()].filter((e) => e.alternatives.includes(exerciseId));
}

/**
 * Pausiert eine Übung nach roter Ampel. Ist sie schon pausiert, wird nur ein
 * schwerer wiegender Grund nachgetragen (Warnzeichen vor Schmerz).
 */
export function pauseExercise(id, dateKey, reason = 'schmerz') {
  const ex = exercise(id);
  if (!ex) return Promise.resolve(true);
  if (ex.paused && (ex.pausedReason === 'warnzeichen' || reason !== 'warnzeichen')) return Promise.resolve(true);
  ex.paused = true;
  ex.pausedSince = ex.pausedSince ?? dateKey;
  ex.pausedReason = reason;
  return saveExercise(ex);
}

export function releaseExercise(id) {
  const ex = exercise(id);
  if (!ex) return Promise.resolve(true);
  ex.paused = false;
  ex.pausedSince = null;
  ex.pausedReason = null;
  return saveExercise(ex);
}

// ---------------------------------------------------------------- Einheiten

export function unit(id) {
  return state.units.get(id) ?? null;
}

export function allUnits() {
  return [...state.units.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export function newUnit(name = 'Neue Einheit') {
  return { id: uid('u'), name, exerciseIds: [], hint: '' };
}

export function saveUnit(u) {
  state.units.set(u.id, u);
  return persist(db.put('units', u));
}

/** Löscht die Einheit und trägt sie aus allen Wochenplänen und als tägliche Einheit aus. */
export function deleteUnit(id) {
  state.units.delete(id);
  const changed = [];
  for (const p of state.phases.values()) {
    let touched = false;
    for (const d of Object.values(p.weekplan)) {
      if (d.unitId === id) {
        d.unitId = null;
        touched = true;
      }
    }
    if (p.dailyUnitId === id) {
      p.dailyUnitId = null;
      touched = true;
    }
    if (touched) changed.push(p);
  }
  return persist(Promise.all([db.remove('units', id), db.putMany('phases', changed)]));
}

/** Phasen und Wochentage, an denen eine Einheit eingeplant ist. weekday 'taeglich' = tägliche Einheit. */
export function unitUsage(id) {
  const out = [];
  for (const p of allPhases()) {
    if (p.dailyUnitId === id) out.push({ phase: p, weekday: 'taeglich' });
    for (const [wd, d] of Object.entries(p.weekplan)) {
      if (d.unitId === id) out.push({ phase: p, weekday: wd });
    }
  }
  return out;
}

/** Tägliche Einheit der Phase, falls es sie gibt und sie Übungen hat. */
export function dailyUnit(p = activePhase()) {
  const u = p?.dailyUnitId ? unit(p.dailyUnitId) : null;
  return u && u.exerciseIds.length ? u : null;
}

/** Ersetzt eine Übung dauerhaft in einer Einheit und merkt sich die alte als Ersatz. */
export function replaceInUnit(unitId, oldId, newId) {
  const u = unit(unitId);
  const fresh = exercise(newId);
  if (!u || !fresh) return Promise.resolve(false);
  u.exerciseIds = u.exerciseIds.map((x) => (x === oldId ? newId : x));
  if (!fresh.alternatives.includes(oldId) && exercise(oldId)) fresh.alternatives.push(oldId);
  return persist(Promise.all([db.put('units', u), db.put('exercises', fresh)]));
}

// ---------------------------------------------------------------- Phasen

export function phase(id) {
  return state.phases.get(id) ?? null;
}

export function allPhases() {
  return [...state.phases.values()].sort((a, b) => a.order - b.order);
}

export function activePhase() {
  return phase(meta('activePhaseId')) ?? allPhases()[0];
}

export function savePhase(p) {
  state.phases.set(p.id, p);
  return persist(db.put('phases', p));
}

// ---------------------------------------------------------------- Trainings

export function trainings() {
  return state.trainings;
}

export function training(id) {
  return state.trainings.find((t) => t.id === id) ?? null;
}

export function trainingsOn(dateKey) {
  return state.trainings.filter((t) => t.date === dateKey);
}

/** Speichert ein Training samt seiner Ausdauerblöcke in einem Zug. */
export async function saveTraining(t, cardioLogs = []) {
  state.trainings = state.trainings.filter((x) => x.id !== t.id).concat(t);
  state.cardio = state.cardio.filter((c) => !cardioLogs.some((n) => n.id === c.id)).concat(cardioLogs);
  sortAll();
  return persist(Promise.all([db.put('trainings', t), db.putMany('cardio', cardioLogs)]));
}

export function deleteTraining(id) {
  const linked = state.cardio.filter((c) => c.trainingId === id);
  state.trainings = state.trainings.filter((t) => t.id !== id);
  state.cardio = state.cardio.filter((c) => c.trainingId !== id);
  return persist(Promise.all([db.remove('trainings', id), ...linked.map((c) => db.remove('cardio', c.id))]));
}

/**
 * Bisherige Ausführungen einer Übung, neueste zuerst, jeweils mit dem
 * Kniecheck vom Folgetag, weil der die Ampelfarbe nachträglich ändern kann.
 */
export function historyFor(exerciseId) {
  const out = [];
  for (const t of state.trainings) {
    for (const entry of t.entries) {
      if (entry.exerciseId === exerciseId) out.push({ entry, training: t, check: checkFor(t.date) });
    }
  }
  return out;
}

/**
 * Quellen für die Vorbelegung. Bei Übungen mit Knie-Ampel kommt das Gewicht
 * nur aus der aktuellen Phasengruppe: Nach einer OP soll die App nicht das
 * Gewicht von vor der OP vorschlagen. Oberkörpergewichte gelten weiter.
 */
export function prefillSources(ex, currentPhase) {
  const history = historyFor(ex.id).filter((h) => !h.entry.skipped && h.entry.sets.some((s) => s.done));
  const repsSource = history[0]?.entry ?? null;
  const weightSource = ex.kneeCheck
    ? history.find((h) => phase(h.training.phaseId)?.group === currentPhase.group)?.entry ?? null
    : repsSource;
  return { repsSource, weightSource, last: history[0] ?? null };
}

// ---------------------------------------------------------------- Ausdauer

export function cardioLogs() {
  return state.cardio;
}

export function cardioLog(id) {
  return state.cardio.find((c) => c.id === id) ?? null;
}

export function saveCardio(c) {
  state.cardio = state.cardio.filter((x) => x.id !== c.id).concat(c);
  sortAll();
  return persist(db.put('cardio', c));
}

export function deleteCardio(id) {
  state.cardio = state.cardio.filter((c) => c.id !== id);
  return persist(db.remove('cardio', id));
}

// ---------------------------------------------------------------- Kniecheck am Folgetag

export function kneeChecks() {
  return state.kneeChecks;
}

/** Kniecheck, der sich auf das Training an diesem Tag bezieht. */
export function checkFor(refDate) {
  return checkIndex.get(refDate) ?? null;
}

export function saveKneeCheck(c) {
  state.kneeChecks = state.kneeChecks.filter((x) => x.id !== c.id && x.refDate !== c.refDate).concat(c);
  sortAll();
  return persist(db.put('kneeChecks', c));
}

// ---------------------------------------------------------------- Freigaben und Messwerte

export function clearances() {
  return state.clearances;
}

export function saveClearance(c) {
  state.clearances = state.clearances.filter((x) => x.id !== c.id).concat(c);
  sortAll();
  return persist(db.put('clearances', c));
}

export function deleteClearance(id) {
  state.clearances = state.clearances.filter((c) => c.id !== id);
  return persist(db.remove('clearances', id));
}

export function measurements() {
  return state.measurements;
}

export function saveMeasurement(m) {
  state.measurements = state.measurements.filter((x) => x.id !== m.id).concat(m);
  sortAll();
  return persist(db.put('measurements', m));
}

export function deleteMeasurement(id) {
  state.measurements = state.measurements.filter((m) => m.id !== id);
  return persist(db.remove('measurements', id));
}

// ---------------------------------------------------------------- Laufendes Training

export function draft() {
  return state.meta.draft ?? null;
}

export function saveDraft(d) {
  return setMeta('draft', d);
}

export function clearDraft() {
  return setMeta('draft', null);
}

// ---------------------------------------------------------------- Backup

export const BACKUP_FORMAT = 'trainings-app-backup';
export const BACKUP_VERSION = 1;

const DATA_LISTS = ['exercises', 'units', 'phases', 'trainings', 'cardio', 'kneeChecks', 'clearances', 'measurements'];

export function exportData() {
  const meta = { ...state.meta };
  delete meta.draft; // ein halbes Training gehört nicht ins Backup
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    data: {
      exercises: [...state.exercises.values()],
      units: [...state.units.values()],
      phases: [...state.phases.values()],
      trainings: state.trainings,
      cardio: state.cardio,
      kneeChecks: state.kneeChecks,
      clearances: state.clearances,
      measurements: state.measurements,
      meta,
    },
  };
}

/** Prüft eine Backup-Datei. Wirft einen Fehler mit verständlicher Meldung. */
export function validateBackup(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Die Datei enthält kein gültiges JSON-Objekt.');
  if (obj.format !== BACKUP_FORMAT) throw new Error('Das ist kein Backup dieser App.');
  if (typeof obj.version !== 'number' || obj.version > BACKUP_VERSION) {
    throw new Error('Das Backup stammt aus einer neueren App-Version. Bitte zuerst die App aktualisieren.');
  }
  const d = obj.data;
  if (!d || typeof d !== 'object') throw new Error('Im Backup fehlen die Daten.');
  for (const name of DATA_LISTS) {
    if (!Array.isArray(d[name])) throw new Error(`Im Backup fehlt der Bereich "${name}".`);
    if (d[name].some((x) => !x || typeof x.id !== 'string')) {
      throw new Error(`Im Bereich "${name}" ist ein Eintrag ohne Kennung.`);
    }
  }
  if (!d.phases.length) throw new Error('Das Backup enthält keine Phasen.');
  if (!d.meta || typeof d.meta !== 'object') throw new Error('Im Backup fehlen die Einstellungen.');
  return obj;
}

/** Ersetzt alle Daten durch das Backup, alles oder nichts. */
export async function importData(obj) {
  validateBackup(obj);
  const d = obj.data;
  const meta = { ...d.meta, lastBackupAt: obj.exportedAt ?? Date.now() };
  delete meta.draft;
  await db.replaceStores({
    ...Object.fromEntries(DATA_LISTS.map((n) => [n, d[n]])),
    meta: Object.entries(meta).map(([key, value]) => ({ key, value })),
  });
  await init();
}

async function replacePlan(plan) {
  const activeId = meta('activePhaseId');
  await db.replaceStores({ exercises: plan.exercises, units: plan.units, phases: plan.phases });
  state.exercises = new Map(plan.exercises.map((x) => [x.id, x]));
  state.units = new Map(plan.units.map((x) => [x.id, x]));
  state.phases = new Map(plan.phases.map((x) => [x.id, x]));
  const active = phase(activeId);
  if (!active || active.locked) await setMeta('activePhaseId', 'p1');
  await setMeta('seedVersion', SEED_VERSION);
}

/** Setzt Übungen, Einheiten und Phasen komplett auf die Startdaten zurück. Der Verlauf bleibt. */
export function resetPlan() {
  return replacePlan(buildSeed());
}

/** true, wenn die App neuere Startdaten mitbringt, als im Plan stehen. */
export function seedUpdateAvailable() {
  return (meta('seedVersion') ?? 1) < SEED_VERSION;
}

/**
 * Übernimmt den überarbeiteten Startplan. Eigene Übungen und Einheiten,
 * Pausierungen und freigeschaltete Phasen bleiben (siehe mergeSeedUpdate).
 * Eine unveränderte Tabu-Liste wird auf die neue Fassung gebracht.
 */
export async function applySeedUpdate() {
  const current = {
    exercises: [...state.exercises.values()],
    units: [...state.units.values()],
    phases: [...state.phases.values()],
  };
  await replacePlan(mergeSeedUpdate(current));
  if (JSON.stringify(meta('tabu')) === JSON.stringify(TABU_V1)) await setMeta('tabu', [...DEFAULT_TABU]);
}

export async function wipeAll() {
  await db.replaceStores(Object.fromEntries(db.STORES.map((s) => [s, []])));
  state.meta = {};
  await init();
}

export function tabu() {
  return meta('tabu', DEFAULT_TABU);
}

/** Bittet den Browser, die Daten nicht bei Speicherknappheit zu löschen. */
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}
