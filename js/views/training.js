// Trainingsmodus: Schritt für Schritt durch Ausdauerblöcke und Übungen.
//
// Das laufende Training ist ein Entwurf in den Meta-Daten und wird bei jeder
// Änderung gespeichert. Wirft iOS die App im Hintergrund aus dem Speicher,
// geht nichts verloren. Erst "Speichern" macht daraus einen Verlaufseintrag.
//
// Jeder Schritt hält eine Kopie der Übungsdaten (snap). Änderungen am Plan
// während des Trainings verändern das laufende Training nicht.

import { h, icon, choose, confirmDialog, toast, openSheet, numberInput } from '../ui/dom.js';
import {
  prefillSets, formatTarget, progressionHint, lastKneeWarning,
  parseNum, formatNum, cardioSummary, ZONE2_HINT, dateKey, KNEE_FLAGS, AMPEL,
} from '../logic.js';
import { CATEGORIES } from '../seed.js';
import { fmtDateShort, fmtDuration, fmtSets } from '../format.js';
import * as store from '../store.js';
import { startRest, stopRest, runHold } from '../ui/timer.js';
import { keepScreenOn, unlockAudio } from '../ui/device.js';
import { rateKnee, statusBadge } from '../ui/sheets.js';
import { pickExercise } from '../ui/picker.js';
import { cardioFields } from './ausdauer.js';

// ---------------------------------------------------------------- Aufbau der Schritte

function snapshot(ex) {
  return {
    name: ex.name,
    category: ex.category,
    mode: ex.mode,
    perSide: ex.perSide,
    weighted: ex.weighted,
    assisted: ex.assisted,
    kneeCheck: ex.kneeCheck,
    restSec: ex.restSec,
    hint: ex.hint,
    target: { sets: ex.sets, min: ex.min, max: ex.max },
  };
}

function exerciseStep(ex, phase, plannedId = ex.id) {
  const { repsSource, weightSource } = store.prefillSources(ex, phase);
  return {
    type: 'exercise',
    exerciseId: ex.id,
    plannedId,
    snap: snapshot(ex),
    sets: prefillSets(ex, repsSource, weightSource),
    knee: null,
    skipped: ex.paused,
    paused: ex.paused,
  };
}

function cardioStep(block, pos) {
  return {
    type: 'cardio',
    pos,
    plan: block,
    log: { type: block.types[0], minutes: block.max ?? block.min, puls: null, watt: null, note: '' },
    done: false,
    skipped: false,
  };
}

/** Legt ein neues Training an und öffnet den Trainingsmodus. */
export async function startTraining(ctx, { unitId = null, before = null, after = null, title = '' }) {
  if (store.draft()) {
    const ok = await confirmDialog('Es läuft schon ein Training. Soll es verworfen und ein neues gestartet werden?',
      { title: 'Training läuft', ok: 'Neu starten', danger: true });
    if (!ok) return;
  }
  unlockAudio();
  const phase = store.activePhase();
  const unit = unitId ? store.unit(unitId) : null;
  const steps = [];
  if (before) steps.push(cardioStep(before, 'before'));
  for (const id of unit?.exerciseIds ?? []) {
    const ex = store.exercise(id);
    if (ex) steps.push(exerciseStep(ex, phase));
  }
  if (after) steps.push(cardioStep(after, 'after'));
  if (!steps.length) {
    toast('Diese Einheit hat noch keine Übungen. Bitte zuerst im Plan eintragen.');
    return;
  }
  const draft = {
    id: store.uid('t'),
    date: dateKey(),
    startedAt: Date.now(),
    phaseId: phase.id,
    unitId,
    title: title || unit?.name || 'Training',
    unitHint: unit?.hint ?? '',
    steps,
    index: 0,
    note: '',
  };
  await store.saveDraft(draft);
  keepScreenOn(true);
  ctx.go('/training');
}

// ---------------------------------------------------------------- Speichern

let saveTimer = null;

function saveSoon(d) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => store.saveDraft(d), 400);
}

function saveNow(d) {
  clearTimeout(saveTimer);
  return store.saveDraft(d);
}

function needsRating(step) {
  return step.type === 'exercise' && step.snap.kneeCheck && !step.skipped && !step.knee && step.sets.some((s) => s.done);
}

function stepDone(step) {
  if (step.type === 'cardio') return step.done;
  return !step.skipped && step.sets.every((s) => s.done);
}

async function askKnee(d, step) {
  const result = await rateKnee(step.snap.name, step.knee);
  if (!result) return false;
  step.knee = result;
  if (result.color === 'rot') {
    // Sofort pausieren, nicht erst beim Speichern: Die Pause soll auch dann
    // gelten, wenn das Training später verworfen wird.
    await store.pauseExercise(step.exerciseId, d.date);
    toast('Übung pausiert. Freigeben im Plan unter der Übung.', { duration: 5000 });
  }
  await saveNow(d);
  return true;
}

async function finish(ctx, d) {
  const entries = d.steps.filter((s) => s.type === 'exercise').map((s) => ({
    exerciseId: s.exerciseId,
    plannedId: s.plannedId,
    name: s.snap.name,
    category: s.snap.category,
    mode: s.snap.mode,
    perSide: s.snap.perSide,
    weighted: s.snap.weighted,
    assisted: s.snap.assisted,
    kneeCheck: s.snap.kneeCheck,
    target: { ...s.snap.target },
    sets: s.sets.map((x) => ({ ...x })),
    knee: s.knee,
    skipped: s.skipped || !s.sets.some((x) => x.done),
  }));
  const cardio = d.steps.filter((s) => s.type === 'cardio' && s.done && !s.skipped).map((s) => ({
    id: store.uid('c'),
    date: d.date,
    startedAt: d.startedAt,
    trainingId: d.id,
    pos: s.pos,
    type: s.log.type,
    minutes: s.log.minutes,
    puls: s.log.puls,
    watt: s.log.watt,
    note: s.log.note,
  }));

  if (!entries.some((e) => !e.skipped) && !cardio.length) {
    const ok = await confirmDialog('In diesem Training ist nichts erledigt. Trotzdem beenden? Es wird nichts gespeichert.',
      { title: 'Nichts erledigt', ok: 'Beenden', danger: true });
    if (ok) await discard(ctx);
    return;
  }

  const training = {
    id: d.id,
    date: d.date,
    startedAt: d.startedAt,
    finishedAt: Date.now(),
    phaseId: d.phaseId,
    unitId: d.unitId,
    title: d.title,
    entries,
    cardioIds: cardio.map((c) => c.id),
    note: d.note,
  };
  clearTimeout(saveTimer);
  if (!await store.saveTraining(training, cardio)) return;
  await store.clearDraft();
  stopRest();
  keepScreenOn(false);
  toast('Training gespeichert');
  ctx.go('/heute');
}

async function discard(ctx) {
  clearTimeout(saveTimer);
  stopRest();
  keepScreenOn(false);
  await store.clearDraft();
  ctx.go('/heute');
}

async function endDialog(ctx, d) {
  const v = await choose('Training beenden', [
    { label: 'Speichern und beenden', value: 'save', kind: 'primary', detail: 'Erledigte Sätze kommen in den Verlauf.' },
    { label: 'Verwerfen', value: 'discard', kind: 'danger-outline' },
    { label: 'Weiter trainieren', value: null },
  ]);
  if (v === 'save') await finish(ctx, d);
  if (v === 'discard') {
    const ok = await confirmDialog('Alle Einträge dieses Trainings gehen verloren.', { title: 'Training verwerfen', ok: 'Verwerfen', danger: true });
    if (ok) await discard(ctx);
  }
}

// ---------------------------------------------------------------- Ansicht

export function render(ctx) {
  const d = store.draft();
  if (!d) return ctx.replace('/heute');
  keepScreenOn(true);

  const total = d.steps.length;
  d.index = Math.min(Math.max(0, d.index), total);
  const goto = (i) => {
    d.index = Math.min(Math.max(0, i), total);
    saveNow(d);
    ctx.refresh({ scrollTop: true });
  };

  ctx.top({
    title: d.title,
    left: h('button', { class: 'top-text-btn', onclick: () => endDialog(ctx, d) }, 'Beenden'),
  });

  ctx.main.append(progressHeader(d, goto));
  const step = d.steps[d.index];
  if (!step) ctx.main.append(summaryView(d));
  else if (step.type === 'cardio') ctx.main.append(cardioView(ctx, d, step, goto));
  else ctx.main.append(exerciseView(ctx, d, step, goto));
  ctx.main.append(footer(ctx, d, goto));
}

function progressHeader(d, goto) {
  const total = d.steps.length;
  const exSteps = d.steps.filter((s) => s.type === 'exercise');
  const current = d.steps[d.index];
  let label;
  if (!current) label = 'Abschluss';
  else if (current.type === 'cardio') label = current.pos === 'before' ? 'Ausdauer davor' : 'Ausdauer danach';
  else label = `Übung ${exSteps.indexOf(current) + 1} von ${exSteps.length}`;

  const bar = h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(d.index) },
    ...d.steps.map((s, i) => h('span', { class: `seg-step ${stepDone(s) ? 'done' : ''} ${s.skipped ? 'skipped' : ''} ${i === d.index ? 'current' : ''}` })));

  return h('div', { class: 'train-head' },
    h('div', { class: 'train-head-row' },
      h('span', { class: 'train-pos' }, label),
      h('button', { class: 'link-btn', onclick: () => overviewSheet(d, goto) }, 'Übersicht')),
    bar);
}

function overviewSheet(d, goto) {
  const list = h('div', { class: 'pick-list' });
  const sheet = openSheet({ title: 'Übersicht', cls: 'tall', body: list });
  d.steps.forEach((s, i) => {
    const name = s.type === 'cardio' ? cardioSummary(s.plan) : s.snap.name;
    const state = s.type === 'cardio'
      ? (s.skipped ? 'übersprungen' : s.done ? 'erledigt' : '')
      : s.paused && s.skipped ? 'pausiert' : s.skipped ? 'übersprungen' : `${s.sets.filter((x) => x.done).length} von ${s.sets.length} Sätzen`;
    list.append(h('button', { class: `pick-row ${i === d.index ? 'current' : ''}`, onclick: () => { sheet.close(); goto(i); } },
      h('span', { class: 'pick-name' }, name),
      h('span', { class: 'pick-meta' }, state, s.knee ? statusBadge(s.knee.color) : null)));
  });
  list.append(h('button', { class: `pick-row ${d.index === d.steps.length ? 'current' : ''}`, onclick: () => { sheet.close(); goto(d.steps.length); } },
    h('span', { class: 'pick-name' }, 'Abschluss und Speichern')));
}

function footer(ctx, d, goto) {
  const step = d.steps[d.index];
  const isSummary = !step;
  const isLast = d.index === d.steps.length - 1;

  async function next() {
    if (step?.type === 'exercise' && needsRating(step)) {
      if (!await askKnee(d, step)) return;
    }
    if (step?.type === 'cardio' && !step.skipped && !step.done) {
      // "Weiter" heißt hier: wie geplant gemacht. Spart einen Extra-Knopf.
      step.done = true;
    }
    goto(d.index + 1);
  }

  return h('div', { class: 'train-footer' },
    h('button', { class: 'btn secondary', disabled: d.index === 0, onclick: () => goto(d.index - 1) }, icon('back'), 'Zurück'),
    isSummary
      ? h('button', { class: 'btn primary', onclick: () => finish(ctx, d) }, 'Training speichern')
      : h('button', { class: 'btn primary', onclick: next }, isLast ? 'Abschließen' : 'Weiter', icon('next')));
}

// ---------------------------------------------------------------- Übung

function infoBox(kind, ...content) {
  return h('div', { class: `box ${kind}` }, ...content);
}

function exerciseView(ctx, d, step, goto) {
  const snap = step.snap;
  const box = h('section', { class: 'step' });
  const targetText = formatTarget({ ...snap.target, mode: snap.mode, perSide: snap.perSide });

  box.append(
    h('div', { class: 'step-cat' }, CATEGORIES[snap.category] ?? ''),
    h('h1', { class: 'step-title' }, snap.name),
    h('div', { class: 'step-target' }, targetText, snap.restSec ? ` · Pause ${snap.restSec} s` : ''));

  if (step.paused && step.skipped) {
    const ex = store.exercise(step.exerciseId);
    box.append(infoBox('bad',
      h('strong', null, 'Pausiert'),
      h('p', null, `Seit ${ex?.pausedSince ? fmtDateShort(ex.pausedSince) : 'dem letzten Rot'} wegen Knie-Ampel Rot. ${AMPEL.rot.rule}.`)),
    h('div', { class: 'stack' },
      h('button', { class: 'btn secondary block', onclick: async () => {
        const ok = await confirmDialog('Nur freigeben, wenn das ärztlich abgeklärt ist.', { title: 'Übung freigeben', ok: 'Freigeben' });
        if (!ok) return;
        await store.releaseExercise(step.exerciseId);
        step.paused = false;
        step.skipped = false;
        await saveNow(d);
        ctx.refresh();
      } }, 'Freigeben und heute machen'),
      h('button', { class: 'btn secondary block', onclick: () => tauschen(ctx, d, step) }, icon('swap'), 'Ersatzübung machen')));
    return box;
  }

  if (step.skipped) {
    box.append(infoBox('note', h('strong', null, 'Übersprungen')),
      h('button', { class: 'btn secondary block', onclick: () => { step.skipped = false; saveNow(d); ctx.refresh(); } }, 'Doch machen'));
    return box;
  }

  const history = store.historyFor(step.exerciseId);
  const firstExercise = d.steps.find((s) => s.type === 'exercise') === step;
  if (firstExercise && d.unitHint) box.append(infoBox('note', d.unitHint));
  if (snap.hint) box.append(infoBox('note', snap.hint));
  const hint = progressionHint(history);
  if (hint) box.append(infoBox('good', h('strong', null, hint.text)));
  const warning = lastKneeWarning(history);
  if (warning) box.append(infoBox('warn', h('strong', null, warning.text)));

  const last = history.find((x) => !x.entry.skipped && x.entry.sets.some((s) => s.done));
  if (last) {
    const otherPhase = last.training.phaseId !== d.phaseId ? `, ${store.phase(last.training.phaseId)?.name ?? ''}` : '';
    box.append(h('p', { class: 'last-time' }, `Letztes Mal (${fmtDateShort(last.training.date)}${otherPhase}): `, h('strong', null, fmtSets(last.entry))));
  }

  box.append(h('div', { class: 'sets' }, ...step.sets.map((set, i) => setRow(ctx, d, step, set, i))));

  box.append(h('div', { class: 'row-actions' },
    h('button', { class: 'btn small secondary', onclick: () => {
      const prev = step.sets.at(-1);
      step.sets.push({ weight: prev?.weight ?? null, reps: prev?.reps ?? null, hold: prev?.hold ?? null, done: false });
      saveNow(d);
      ctx.refresh();
    } }, icon('plus'), 'Satz'),
    h('button', { class: 'btn small secondary', disabled: step.sets.length <= 1, onclick: () => {
      step.sets.pop();
      saveNow(d);
      ctx.refresh();
    } }, icon('minus'), 'Satz')));

  if (snap.kneeCheck) {
    if (step.knee) {
      const flags = Object.entries(step.knee.flags ?? {}).filter(([, v]) => v).map(([k]) => KNEE_FLAGS[k]);
      box.append(h('div', { class: `ampel-result r-${step.knee.color}` },
        h('div', { class: 'ampel-line' }, statusBadge(step.knee.color), h('span', null, `Schmerz ${step.knee.pain ?? '-'}`), flags.length ? h('span', { class: 'muted' }, flags.join(', ')) : null),
        h('p', null, AMPEL[step.knee.color].rule),
        h('button', { class: 'link-btn', onclick: async () => { if (await askKnee(d, step)) ctx.refresh(); } }, 'Ändern')));
    } else {
      box.append(h('button', { class: 'btn secondary block', onclick: async () => { if (await askKnee(d, step)) ctx.refresh(); } }, 'Knie bewerten'));
    }
  }

  box.append(h('div', { class: 'row-actions tools' },
    h('button', { class: 'btn small secondary', onclick: () => tauschen(ctx, d, step) }, icon('swap'), 'Tauschen'),
    h('button', { class: 'btn small secondary', onclick: () => { step.skipped = true; goto(d.index + 1); } }, icon('skip'), 'Überspringen')));

  return box;
}

function setRow(ctx, d, step, set, i) {
  const snap = step.snap;
  const n = i + 1;
  const cells = [h('span', { class: 'set-no', 'aria-hidden': 'true' }, String(n))];

  if (snap.weighted) {
    cells.push(h('label', { class: 'set-field' },
      h('span', null, snap.assisted ? 'Hilfe kg' : 'kg'),
      numberInput({ label: `Gewicht Satz ${n}`, value: formatNum(set.weight), onInput: (v) => { set.weight = parseNum(v); saveSoon(d); } })));
  }
  if (snap.mode === 'reps') {
    cells.push(h('label', { class: 'set-field' },
      h('span', null, 'Wdh.'),
      numberInput({ label: `Wiederholungen Satz ${n}`, value: formatNum(set.reps), decimal: false, onInput: (v) => { set.reps = parseNum(v); saveSoon(d); } })));
  } else {
    cells.push(h('label', { class: 'set-field' },
      h('span', null, 'Sek.'),
      numberInput({ label: `Haltezeit Satz ${n}`, value: formatNum(set.hold), decimal: false, onInput: (v) => { set.hold = parseNum(v); saveSoon(d); } })));
    cells.push(h('button', {
      class: 'set-play',
      'aria-label': `Countdown für Satz ${n} starten`,
      onclick: () => runHold({
        name: snap.name,
        seconds: set.hold || snap.target.min,
        perSide: snap.perSide,
        onDone: (held) => {
          set.hold = held;
          markDone(ctx, d, step, set);
        },
      }),
    }, icon('play')));
  }

  cells.push(h('button', {
    class: 'set-check',
    'aria-pressed': String(set.done),
    'aria-label': `Satz ${n} erledigt`,
    onclick: () => {
      if (set.done) {
        set.done = false;
        saveNow(d);
        ctx.refresh();
      } else {
        markDone(ctx, d, step, set);
      }
    },
  }, icon('check')));

  return h('div', { class: `set-row ${set.done ? 'done' : ''}` }, ...cells);
}

async function markDone(ctx, d, step, set) {
  set.done = true;
  // Leeres Feld beim Abhaken: Zielwert übernehmen statt "0" zu speichern.
  if (step.snap.mode === 'reps' && set.reps == null) set.reps = step.snap.target.min;
  if (step.snap.mode === 'hold' && set.hold == null) set.hold = step.snap.target.min;
  // Beim ersten Mal steht nirgends ein Gewicht. Was im ersten Satz eingetragen
  // wurde, gilt dann auch für die folgenden leeren Sätze.
  if (set.weight != null) {
    for (const later of step.sets.slice(step.sets.indexOf(set) + 1)) {
      if (!later.done && later.weight == null) later.weight = set.weight;
    }
  }
  startRest(step.snap.restSec);
  await saveNow(d);
  ctx.refresh();
  if (step.sets.every((s) => s.done) && needsRating(step)) {
    if (await askKnee(d, step)) ctx.refresh();
  }
}

async function tauschen(ctx, d, step) {
  const planned = store.exercise(step.plannedId);
  const preferred = [...(planned?.alternatives ?? [])];
  if (step.exerciseId !== step.plannedId && planned) preferred.unshift(step.plannedId);
  const id = await pickExercise({ title: 'Übung tauschen', exclude: [step.exerciseId], preferred, allowNew: false });
  if (!id) return;
  const alt = store.exercise(id);
  const phase = store.phase(d.phaseId) ?? store.activePhase();
  const unit = d.unitId ? store.unit(d.unitId) : null;

  let scope = 'today';
  if (unit && unit.exerciseIds.includes(step.plannedId) && id !== step.plannedId) {
    scope = await choose('Wie tauschen?', [
      { label: 'Nur heute', value: 'today', kind: 'primary' },
      { label: `Dauerhaft in „${unit.name}“`, value: 'plan', detail: 'Die bisherige Übung bleibt als Ersatz hinterlegt.' },
    ]);
    if (!scope) return;
  }
  if (scope === 'plan') {
    await store.replaceInUnit(unit.id, step.plannedId, id);
    Object.assign(step, exerciseStep(alt, phase, id));
  } else {
    Object.assign(step, exerciseStep(alt, phase, step.plannedId));
  }
  await saveNow(d);
  ctx.refresh({ scrollTop: true });
}

// ---------------------------------------------------------------- Ausdauer

function cardioView(ctx, d, step) {
  const box = h('section', { class: 'step' });
  box.append(
    h('div', { class: 'step-cat' }, step.pos === 'before' ? 'Ausdauer davor' : 'Ausdauer danach'),
    h('h1', { class: 'step-title' }, cardioSummary(step.plan)));
  if (step.plan.zone2) box.append(infoBox('note', h('strong', null, 'Zone 2. '), ZONE2_HINT));

  if (step.skipped) {
    box.append(infoBox('note', h('strong', null, 'Übersprungen')),
      h('button', { class: 'btn secondary block', onclick: () => { step.skipped = false; saveNow(d); ctx.refresh(); } }, 'Doch machen'));
    return box;
  }

  box.append(
    h('div', { class: 'card' }, cardioFields(step.log, () => saveSoon(d), step.plan.types)),
    h('p', { class: 'muted small' }, step.done ? 'Eingetragen. Werte lassen sich noch ändern.' : 'Mit "Weiter" wird die Einheit so eingetragen.'),
    h('div', { class: 'row-actions tools' },
      h('button', { class: 'btn small secondary', onclick: () => { step.skipped = true; step.done = false; saveNow(d); ctx.refresh(); } }, icon('skip'), 'Überspringen')));
  return box;
}

// ---------------------------------------------------------------- Abschluss

function summaryView(d) {
  const rows = d.steps.map((s) => {
    if (s.type === 'cardio') {
      return h('div', { class: 'sum-row' },
        h('span', { class: 'sum-name' }, cardioSummary(s.plan)),
        h('span', { class: 'sum-meta' }, s.skipped ? 'übersprungen' : s.done ? `${formatNum(s.log.minutes)} min` : 'offen'));
    }
    const done = s.sets.filter((x) => x.done).length;
    const meta = s.paused && s.skipped ? 'pausiert' : s.skipped ? 'übersprungen' : `${done} von ${s.sets.length} Sätzen`;
    return h('div', { class: 'sum-row' },
      h('span', { class: 'sum-name' }, s.snap.name),
      h('span', { class: 'sum-meta' }, meta, s.knee ? statusBadge(s.knee.color) : null));
  });

  return h('section', { class: 'step' },
    h('div', { class: 'step-cat' }, 'Abschluss'),
    h('h1', { class: 'step-title' }, d.title),
    h('div', { class: 'step-target' }, `Dauer bisher ${fmtDuration(Date.now() - d.startedAt)}`),
    h('div', { class: 'card sum-list' }, ...rows),
    h('label', { class: 'field' },
      h('span', { class: 'field-label' }, 'Notiz zum Training'),
      h('textarea', { rows: 3, value: d.note ?? '', oninput: (e) => { d.note = e.target.value; saveSoon(d); } })));
}
