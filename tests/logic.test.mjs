// Tests für Fachlogik, Formatierung, Startdaten und Backup-Prüfung.
// Aufruf: npm test  (oder: node --test tests/)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ampelColor, worseColor, morningVerdict, effectiveColor, pendingMorningCheck,
  entryAchieved, progressionHint, lastKneeWarning, prefillSets, formatTarget,
  resolveDay, dayTitle, phaseIsEmpty, cardioSummary, backupStatus,
  dateKey, addDays, daysBetween, weekdayOf, weekStart, parseNum, formatNum,
  entryValue, trainingKnee, WEEKDAYS,
} from '../js/logic.js';
import { fmtSets, fmtClock, fmtDuration } from '../js/format.js';
import { buildSeed } from '../js/seed.js';
import { validateBackup, BACKUP_FORMAT } from '../js/store.js';

// ---------------------------------------------------------------- Hilfen

function entry({ sets = 3, min = 10, max = 12, done = [12, 12, 12], color = 'gruen', kneeCheck = true, weighted = true, weight = 50, mode = 'reps', assisted = false } = {}) {
  return {
    exerciseId: 'x', kneeCheck, weighted, assisted, mode,
    target: { sets, min, max },
    sets: done.map((v) => ({ weight, reps: mode === 'reps' ? v : null, hold: mode === 'hold' ? v : null, done: true })),
    knee: color ? { pain: 1, flags: {}, color } : null,
    skipped: false,
  };
}

// ---------------------------------------------------------------- Ampel

test('Ampelfarbe aus Schmerzwert', () => {
  assert.equal(ampelColor(0), 'gruen');
  assert.equal(ampelColor(3), 'gruen');
  assert.equal(ampelColor(4), 'gelb');
  assert.equal(ampelColor(5), 'gelb');
  assert.equal(ampelColor(6), 'rot');
  assert.equal(ampelColor(10), 'rot');
  assert.equal(ampelColor(null), null);
});

test('Warnzeichen ergeben immer Rot', () => {
  assert.equal(ampelColor(0, { wegknicken: true }), 'rot');
  assert.equal(ampelColor(null, { blockieren: true }), 'rot');
  assert.equal(ampelColor(2, { stechend: false }), 'gruen');
});

test('schlechtere Farbe gewinnt', () => {
  assert.equal(worseColor('gruen', 'gelb'), 'gelb');
  assert.equal(worseColor('rot', 'gelb'), 'rot');
  assert.equal(worseColor(null, 'gruen'), 'gruen');
  assert.equal(worseColor(null, null), null);
});

test('Kniecheck am Morgen', () => {
  assert.equal(morningVerdict(null), null);
  assert.equal(morningVerdict({ schlimmer: false, schwellung: false, stroke: '' }), 'ok');
  assert.equal(morningVerdict({ schlimmer: false, schwellung: false, stroke: 'Spur' }), 'ok');
  assert.equal(morningVerdict({ schlimmer: false, schwellung: false, stroke: '1+' }), 'halten');
  assert.equal(morningVerdict({ schlimmer: false, schwellung: false, stroke: '2+' }), 'gelb');
  assert.equal(morningVerdict({ schlimmer: true, schwellung: false, stroke: '' }), 'gelb');
  assert.equal(morningVerdict({ schlimmer: false, schwellung: true, stroke: '0' }), 'gelb');
  assert.equal(morningVerdict({ schlimmer: false, schwellung: false, stroke: '3+' }), 'rot');
});

test('Grün wird Gelb, wenn das Knie am Morgen schlimmer ist', () => {
  const e = entry();
  assert.equal(effectiveColor(e, null), 'gruen');
  assert.equal(effectiveColor(e, { schlimmer: true, schwellung: false }), 'gelb');
  assert.equal(effectiveColor(entry({ color: 'rot' }), { schlimmer: true }), 'rot');
  assert.equal(effectiveColor(entry({ color: null }), { schlimmer: true }), null);
});

test('Kniecheck nur am Tag nach einem Beintraining', () => {
  const legs = { id: 't1', date: '2026-11-14', entries: [entry()] };
  const upper = { id: 't2', date: '2026-11-14', entries: [entry({ kneeCheck: false })] };
  assert.equal(pendingMorningCheck([legs], [], '2026-11-15'), '2026-11-14');
  assert.equal(pendingMorningCheck([legs], [{ refDate: '2026-11-14' }], '2026-11-15'), null);
  assert.equal(pendingMorningCheck([upper], [], '2026-11-15'), null);
  assert.equal(pendingMorningCheck([legs], [], '2026-11-16'), null);
});

// ---------------------------------------------------------------- Steigerung

test('Ziel erreicht nur mit allen Sätzen am unteren Wert', () => {
  assert.equal(entryAchieved(entry()), true);
  assert.equal(entryAchieved(entry({ done: [12, 12] })), false);
  assert.equal(entryAchieved(entry({ done: [12, 12, 9] })), false);
  assert.equal(entryAchieved({ ...entry(), skipped: true }), false);
});

test('Steigerungshinweis nach zweimal geschafft und grün', () => {
  const h = (e, check = null) => ({ entry: e, check });
  assert.equal(progressionHint([h(entry())]), null, 'einmal reicht nicht');
  assert.match(progressionHint([h(entry({ done: [10, 11, 10] })), h(entry())]).text, /erst Wiederholungen, dann Gewicht/);
  assert.equal(progressionHint([h(entry({ color: 'gelb' })), h(entry())]), null, 'gelb sperrt');
  assert.equal(progressionHint([h(entry()), h(entry(), { schlimmer: true })]), null, 'Morgen schlimmer sperrt');
  assert.equal(progressionHint([h(entry(), { stroke: '1+' }), h(entry())]), null, '1+ heißt halten');
  assert.match(progressionHint([h(entry()), h(entry())]).text, /Gewicht leicht erhöhen/, 'oben angekommen');
  assert.match(progressionHint([h(entry({ assisted: true })), h(entry({ assisted: true }))]).text, /Unterstützung/);
  assert.match(progressionHint([h(entry({ mode: 'hold', min: 30, max: 45, done: [30, 30, 30] })), h(entry({ mode: 'hold', min: 30, max: 45, done: [30, 30, 30] }))]).text, /Haltezeit/);
});

test('Oberkörper braucht keine Ampel für den Hinweis', () => {
  const e = entry({ kneeCheck: false, color: null, done: [10, 10, 10] });
  assert.ok(progressionHint([{ entry: e }, { entry: e }]));
});

test('übersprungene Einträge zählen nicht', () => {
  const skipped = { ...entry({ color: 'rot' }), skipped: true };
  assert.ok(progressionHint([{ entry: skipped }, { entry: entry() }, { entry: entry() }]));
});

test('Warnung nach Gelb beim letzten Mal', () => {
  assert.match(lastKneeWarning([{ entry: entry({ color: 'gelb' }) }]).text, /zurücknehmen/);
  assert.equal(lastKneeWarning([{ entry: entry() }]), null);
});

test('Vorbelegung mit den Werten vom letzten Mal', () => {
  const ex = { sets: 4, mode: 'reps', min: 8, max: 10, weighted: true };
  const last = { sets: [{ weight: 60, reps: 10 }, { weight: 62.5, reps: 9 }] };
  const sets = prefillSets(ex, last, last);
  assert.equal(sets.length, 4);
  assert.deepEqual(sets.map((s) => s.weight), [60, 62.5, 62.5, 62.5]);
  assert.deepEqual(sets.map((s) => s.reps), [10, 9, 9, 9]);
  assert.ok(sets.every((s) => s.done === false));
});

test('Vorbelegung ohne Gewichtsquelle lässt das Gewicht leer', () => {
  const ex = { sets: 3, mode: 'reps', min: 10, max: 12, weighted: true };
  const sets = prefillSets(ex, { sets: [{ weight: 80, reps: 12 }] }, null);
  assert.deepEqual(sets.map((s) => s.weight), [null, null, null]);
  assert.deepEqual(sets.map((s) => s.reps), [12, 12, 12]);
});

test('Vorbelegung ohne Verlauf nimmt den unteren Zielwert', () => {
  const hold = prefillSets({ sets: 2, mode: 'hold', min: 30, max: 45, weighted: false }, null, null);
  assert.deepEqual(hold.map((s) => s.hold), [30, 30]);
  assert.deepEqual(hold.map((s) => s.weight), [null, null]);
});

// ---------------------------------------------------------------- Plan

test('Klausurmodus lässt nur Mo, Di, Fr', () => {
  const { phases } = buildSeed();
  const p1 = phases.find((p) => p.id === 'p1');
  assert.equal(resolveDay(p1, 'mi', false).rest, false);
  assert.equal(resolveDay(p1, 'mi', true).rest, true);
  assert.equal(resolveDay(p1, 'mi', true).exam, true);
  for (const wd of ['mo', 'di', 'fr']) assert.equal(resolveDay(p1, wd, true).rest, false);
  assert.equal(resolveDay(p1, 'so', false).note, 'Frei, Spaziergang');
});

test('Tagestitel', () => {
  const { phases } = buildSeed();
  const p1 = phases.find((p) => p.id === 'p1');
  assert.equal(dayTitle(resolveDay(p1, 'sa', false), null), 'Lange Ausdauer');
  assert.equal(dayTitle(resolveDay(p1, 'di', false), 'Beine Prehab A'), 'Beine Prehab A');
  assert.equal(dayTitle(resolveDay(p1, 'so', false), null), 'Frei, Spaziergang');
});

test('Phase 4 ist anfangs leer, die anderen nicht', () => {
  const { phases } = buildSeed();
  for (const p of phases) assert.equal(phaseIsEmpty(p), p.id === 'p4', p.id);
});

test('Ausdauer-Zusammenfassung und Zielformat', () => {
  assert.equal(cardioSummary({ types: ['ergometer'], min: 15, max: 15, zone2: false, text: 'locker' }), '15 min Ergometer, locker');
  assert.equal(cardioSummary({ types: ['rad_indoor', 'schwimmen'], min: 60, max: 90, zone2: true, text: '' }), '60–90 min Rad indoor oder Schwimmen, Zone 2');
  assert.equal(formatTarget({ sets: 3, min: 10, max: 12, mode: 'reps' }), '3 × 10–12');
  assert.equal(formatTarget({ sets: 4, min: 30, max: 45, mode: 'hold' }), '4 × 30–45 s');
  assert.equal(formatTarget({ sets: 3, min: 10, max: 10, mode: 'reps', perSide: true }), '3 × 10 je Seite');
});

// ---------------------------------------------------------------- Startdaten

test('Startdaten sind in sich stimmig', () => {
  const { exercises, units, phases } = buildSeed();
  const exIds = new Set(exercises.map((e) => e.id));
  assert.equal(exIds.size, exercises.length, 'doppelte Übungs-IDs');
  const unitIds = new Set(units.map((u) => u.id));
  assert.equal(unitIds.size, units.length, 'doppelte Einheiten-IDs');

  for (const e of exercises) {
    assert.ok(e.name && e.sets > 0 && e.min > 0 && e.max >= e.min, `Übung ${e.id} unvollständig`);
    for (const alt of e.alternatives) {
      assert.ok(exIds.has(alt), `Ersatz ${alt} von ${e.id} fehlt`);
      assert.notEqual(alt, e.id, `${e.id} ist sein eigener Ersatz`);
    }
  }
  for (const u of units) {
    for (const id of u.exerciseIds) assert.ok(exIds.has(id), `Übung ${id} in ${u.id} fehlt`);
    assert.equal(new Set(u.exerciseIds).size, u.exerciseIds.length, `doppelte Übung in ${u.id}`);
  }
  for (const p of phases) {
    assert.deepEqual(Object.keys(p.weekplan).sort(), [...WEEKDAYS].sort(), `Wochentage in ${p.id}`);
    for (const d of Object.values(p.weekplan)) {
      if (d.unitId) assert.ok(unitIds.has(d.unitId), `Einheit ${d.unitId} in ${p.id} fehlt`);
    }
  }
});

test('Phase 1 hat zwei Beintage und Klimmzüge am Ziehen-Tag', () => {
  const { units, phases } = buildSeed();
  const p1 = phases.find((p) => p.id === 'p1');
  assert.equal(p1.weekplan.di.unitId, 'u-beine-a');
  assert.equal(p1.weekplan.fr.unitId, 'u-beine-b');
  assert.ok(units.find((u) => u.id === 'u-ziehen').exerciseIds.includes('klimmzuege'));
  assert.ok(units.find((u) => u.id === 'u-beine-a').exerciseIds.includes('gerades-beinheben'));
});

test('Phase 2a enthält keine Klimmzüge und kein Rudern einarmig', () => {
  const { units, phases } = buildSeed();
  const p2a = phases.find((p) => p.id === 'p2a');
  const ids = Object.values(p2a.weekplan).filter((d) => d.unitId)
    .flatMap((d) => units.find((u) => u.id === d.unitId).exerciseIds);
  assert.ok(!ids.includes('klimmzuege'));
  assert.ok(!ids.includes('rudern-einarmig'));
  assert.ok(!ids.includes('cable-crunch'), 'kein Knien nach der Achskorrektur');
});

test('2b und 2c sind anfangs gesperrt', () => {
  const { phases } = buildSeed();
  const locked = phases.filter((p) => p.locked).map((p) => p.id);
  assert.deepEqual(locked, ['p2b', 'p2c']);
});

test('buildSeed liefert jedes Mal frische Objekte', () => {
  const a = buildSeed();
  const b = buildSeed();
  a.exercises[0].name = 'geändert';
  a.phases[0].weekplan.mo.unitId = null;
  assert.notEqual(b.exercises[0].name, 'geändert');
  assert.notEqual(b.phases[0].weekplan.mo.unitId, null);
});

// ---------------------------------------------------------------- Datum und Zahlen

test('Kalendertage über die Zeitumstellung', () => {
  assert.equal(addDays('2026-03-28', 1), '2026-03-29');
  assert.equal(addDays('2026-03-29', 1), '2026-03-30');
  assert.equal(addDays('2026-10-25', 1), '2026-10-26');
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('Wochentag und Wochenbeginn', () => {
  assert.equal(weekdayOf('2026-11-15'), 'so');
  assert.equal(weekdayOf('2026-11-16'), 'mo');
  assert.equal(weekStart('2026-11-15'), '2026-11-09');
  assert.equal(weekStart('2026-11-16'), '2026-11-16');
  assert.equal(dateKey(new Date(2026, 0, 5, 0, 30)), '2026-01-05');
});

test('Zahlen mit Komma', () => {
  assert.equal(parseNum('12,5'), 12.5);
  assert.equal(parseNum('12.5'), 12.5);
  assert.equal(parseNum(' 40 '), 40);
  assert.equal(parseNum(''), null);
  assert.equal(parseNum('abc'), null);
  assert.equal(formatNum(12.5), '12,5');
  assert.equal(formatNum(null), '');
});

test('Backup-Erinnerung nach mehr als 14 Tagen', () => {
  const day = 86_400_000;
  const now = 100 * day;
  assert.equal(backupStatus(null, now - 3 * day, now).due, false);
  assert.equal(backupStatus(null, now - 15 * day, now).due, true);
  assert.equal(backupStatus(null, now - 15 * day, now).never, true);
  assert.equal(backupStatus(now - 14 * day, 0, now).due, false);
  assert.equal(backupStatus(now - 15 * day, 0, now).due, true);
});

// ---------------------------------------------------------------- Verlauf

test('Diagrammwert und Knie pro Training', () => {
  assert.equal(entryValue(entry({ weight: 60 })), 60);
  assert.equal(entryValue(entry({ weighted: false, done: [10, 12, 11] })), 12);
  assert.equal(entryValue({ ...entry(), sets: [{ weight: 50, reps: 10, done: false }] }), null);

  const t = { entries: [
    { ...entry({ color: 'gruen' }), knee: { pain: 2, color: 'gruen' } },
    { ...entry({ color: 'gelb' }), knee: { pain: 4, color: 'gelb' } },
    entry({ kneeCheck: false, color: null }),
  ] };
  assert.deepEqual(trainingKnee(t, null), { pain: 4, color: 'gelb' });
  assert.equal(trainingKnee({ entries: [entry({ kneeCheck: false, color: null })] }, null), null);
});

test('Satzformat', () => {
  assert.equal(fmtSets(entry({ weight: 60, done: [12, 12, 11] })), '60 kg × 12 · 12 · 11');
  assert.equal(fmtSets(entry({ weighted: false, done: [10, 10] })), '10 · 10 Wdh.');
  assert.equal(fmtSets(entry({ mode: 'hold', weighted: false, done: [30, 25] })), '30 s · 25 s');
  assert.equal(fmtSets(entry({ assisted: true, weight: 20, done: [8] })), 'Hilfe 20 kg × 8');
  const mixed = { ...entry(), sets: [{ weight: 60, reps: 12, done: true }, { weight: 65, reps: 10, done: true }] };
  assert.equal(fmtSets(mixed), '60 kg × 12 · 65 kg × 10');
  assert.equal(fmtClock(90), '1:30');
  assert.equal(fmtDuration(65 * 60_000), '1 h 05 min');
});

// ---------------------------------------------------------------- Backup

test('Backup-Prüfung', () => {
  const empty = { exercises: [], units: [], phases: [{ id: 'p1' }], trainings: [], cardio: [], kneeChecks: [], clearances: [], measurements: [], meta: {} };
  assert.doesNotThrow(() => validateBackup({ format: BACKUP_FORMAT, version: 1, exportedAt: 1, data: empty }));
  assert.throws(() => validateBackup(null), /kein gültiges/);
  assert.throws(() => validateBackup({ format: 'anders', version: 1, data: empty }), /kein Backup dieser App/);
  assert.throws(() => validateBackup({ format: BACKUP_FORMAT, version: 99, data: empty }), /neueren App-Version/);
  assert.throws(() => validateBackup({ format: BACKUP_FORMAT, version: 1, data: { ...empty, trainings: undefined } }), /trainings/);
  assert.throws(() => validateBackup({ format: BACKUP_FORMAT, version: 1, data: { ...empty, trainings: [{}] } }), /ohne Kennung/);
  assert.throws(() => validateBackup({ format: BACKUP_FORMAT, version: 1, data: { ...empty, phases: [] } }), /keine Phasen/);
});
