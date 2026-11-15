// Verlauf: alle Trainings, Fortschritt pro Übung, Knie über die Zeit.

import { h, icon, confirmDialog, openSheet, field, numberInput, toast } from '../ui/dom.js';
import {
  CARDIO_TYPES, KNEE_FLAGS, STROKE_GRADES, MORNING_TEXT, AMPEL,
  trainingKnee, entryValue, entryValueUnit, morningVerdict, morningColor, effectiveColor, opReadiness,
  dateKey, parseNum, formatNum,
} from '../logic.js';
import { CATEGORIES } from '../seed.js';
import { fmtDateShort, fmtDate, fmtMonth, fmtDuration, fmtSets } from '../format.js';
import * as store from '../store.js';
import { lineChart } from '../ui/chart.js';
import { statusBadge } from '../ui/sheets.js';

const TABS = [
  ['trainings', 'Trainings'],
  ['uebungen', 'Übungen'],
  ['knie', 'Knie'],
];

export function renderList(ctx) {
  const tab = ctx.params[0] ?? 'trainings';
  ctx.top({ title: 'Verlauf' });
  ctx.main.append(h('nav', { class: 'seg tabs', 'aria-label': 'Verlauf' },
    TABS.map(([id, label]) => h('a', { class: 'chip', href: `#/verlauf/${id}`, 'aria-current': id === tab ? 'page' : null }, label))));
  if (tab === 'uebungen') exercisesTab(ctx);
  else if (tab === 'knie') kneeTab(ctx);
  else trainingsTab(ctx);
}

// ---------------------------------------------------------------- Trainings

function trainingsTab(ctx) {
  const items = [
    ...store.trainings().map((t) => ({ kind: 'training', date: t.date, at: t.startedAt, t })),
    ...store.cardioLogs().filter((c) => !c.trainingId).map((c) => ({ kind: 'cardio', date: c.date, at: c.startedAt ?? 0, c })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at);

  if (!items.length) {
    ctx.main.append(h('div', { class: 'empty' }, 'Noch keine Trainings. Das erste startest du unter "Heute".'));
    return;
  }

  let month = null;
  let list = null;
  for (const it of items) {
    const m = it.date.slice(0, 7);
    if (m !== month) {
      month = m;
      list = h('div', { class: 'list' });
      ctx.main.append(h('h2', { class: 'list-head' }, fmtMonth(it.date)), list);
    }
    list.append(it.kind === 'training' ? trainingRow(it.t) : cardioRow(it.c));
  }
}

function trainingRow(t) {
  const knee = trainingKnee(t, store.checkFor(t.date));
  const done = t.entries.filter((e) => !e.skipped).length;
  const cardio = store.cardioLogs().filter((c) => c.trainingId === t.id);
  const meta = [
    done ? `${done} ${done === 1 ? 'Übung' : 'Übungen'}` : null,
    cardio.length ? cardio.map((c) => `${formatNum(c.minutes)} min ${CARDIO_TYPES[c.type] ?? ''}`).join(', ') : null,
    t.finishedAt ? fmtDuration(t.finishedAt - t.startedAt) : null,
  ].filter(Boolean).join(' · ');
  return h('a', { class: 'list-row', href: `#/verlauf/training/${t.id}` },
    h('span', { class: 'list-date' }, fmtDateShort(t.date)),
    h('span', { class: 'list-main' }, h('span', { class: 'list-title' }, t.title), h('span', { class: 'list-meta' }, meta)),
    knee ? statusBadge(knee.color) : null,
    icon('next', 'chev'));
}

function cardioRow(c) {
  const meta = [`${formatNum(c.minutes)} min`, c.puls ? `${c.puls} bpm` : null, c.watt ? `${c.watt} W` : null].filter(Boolean).join(' · ');
  return h('a', { class: 'list-row', href: `#/ausdauer/${c.id}` },
    h('span', { class: 'list-date' }, fmtDateShort(c.date)),
    h('span', { class: 'list-main' }, h('span', { class: 'list-title' }, `Ausdauer: ${CARDIO_TYPES[c.type] ?? c.type}`), h('span', { class: 'list-meta' }, meta)),
    icon('next', 'chev'));
}

export function renderTraining(ctx) {
  const t = store.training(ctx.params[0]);
  if (!t) return ctx.replace('/verlauf/trainings');
  ctx.top({ title: t.title, back: '#/verlauf/trainings' });
  const check = store.checkFor(t.date);
  const phase = store.phase(t.phaseId);

  ctx.main.append(h('div', { class: 'detail-head' },
    h('div', { class: 'today-date' }, fmtDate(t.date)),
    h('div', { class: 'muted' }, [phase?.name, t.finishedAt ? fmtDuration(t.finishedAt - t.startedAt) : null].filter(Boolean).join(' · '))));

  if (check) {
    const color = morningColor(check);
    ctx.main.append(h('div', { class: `box ${color === 'gruen' ? 'good' : color === 'rot' ? 'bad' : 'warn'}` },
      h('strong', null, 'Kniecheck am Folgetag: '), MORNING_TEXT[morningVerdict(check)]));
  }

  const cardio = store.cardioLogs().filter((c) => c.trainingId === t.id);
  const list = h('div', { class: 'card sum-list' });
  for (const c of cardio.filter((x) => x.pos === 'before')) list.append(cardioSumRow(c));
  for (const e of t.entries) {
    const color = effectiveColor(e, check);
    const flags = Object.entries(e.knee?.flags ?? {}).filter(([, v]) => v).map(([k]) => KNEE_FLAGS[k]);
    list.append(h('a', { class: 'sum-row link', href: `#/verlauf/uebung/${e.exerciseId}` },
      h('span', { class: 'sum-name' }, e.name, e.plannedId && e.plannedId !== e.exerciseId ? h('span', { class: 'muted small' }, ' (getauscht)') : null),
      h('span', { class: 'sum-meta' },
        e.skipped ? 'übersprungen' : fmtSets(e),
        color ? statusBadge(color, `${AMPEL[color].label} ${e.knee.pain ?? ''}`.trim()) : null,
        flags.length ? h('span', { class: 'muted small' }, flags.join(', ')) : null)));
  }
  for (const c of cardio.filter((x) => x.pos !== 'before')) list.append(cardioSumRow(c));
  ctx.main.append(list);

  if (t.note) ctx.main.append(h('section', { class: 'card' }, h('h3', { class: 'sheet-label' }, 'Notiz'), h('p', { class: 'pre' }, t.note)));

  ctx.main.append(h('button', {
    class: 'btn danger-text block',
    onclick: async () => {
      if (!await confirmDialog('Dieses Training und seine Ausdauerblöcke endgültig löschen?', { title: 'Training löschen', ok: 'Löschen', danger: true })) return;
      if (await store.deleteTraining(t.id)) ctx.go('/verlauf/trainings');
    },
  }, icon('trash'), 'Training löschen'));
}

function cardioSumRow(c) {
  const meta = [`${formatNum(c.minutes)} min`, c.puls ? `${c.puls} bpm` : null, c.watt ? `${c.watt} W` : null].filter(Boolean).join(' · ');
  return h('a', { class: 'sum-row link', href: `#/ausdauer/${c.id}` },
    h('span', { class: 'sum-name' }, CARDIO_TYPES[c.type] ?? c.type),
    h('span', { class: 'sum-meta' }, meta));
}

// ---------------------------------------------------------------- Übungen

function exercisesTab(ctx) {
  const byId = new Map();
  // Trainings sind neueste zuerst sortiert: der erste Treffer ist der aktuellste.
  for (const t of store.trainings()) {
    for (const e of t.entries) {
      if (e.skipped) continue;
      const cur = byId.get(e.exerciseId);
      if (cur) cur.count += 1;
      else byId.set(e.exerciseId, { id: e.exerciseId, name: store.exercise(e.exerciseId)?.name ?? e.name, category: e.category, count: 1, last: e, date: t.date });
    }
  }
  if (!byId.size) {
    ctx.main.append(h('div', { class: 'empty' }, 'Sobald du trainiert hast, erscheint hier jede Übung mit ihrem Verlauf.'));
    return;
  }
  for (const [cat, label] of Object.entries(CATEGORIES)) {
    const items = [...byId.values()].filter((x) => x.category === cat).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    if (!items.length) continue;
    ctx.main.append(h('h2', { class: 'list-head' }, label), h('div', { class: 'list' }, items.map((x) =>
      h('a', { class: 'list-row', href: `#/verlauf/uebung/${x.id}` },
        h('span', { class: 'list-main' },
          h('span', { class: 'list-title' }, x.name),
          h('span', { class: 'list-meta' }, `${x.count}× · zuletzt ${fmtDateShort(x.date)}: ${fmtSets(x.last)}`)),
        icon('next', 'chev')))));
  }
}

export function renderExercise(ctx) {
  const id = ctx.params[0];
  const ex = store.exercise(id);
  const history = store.historyFor(id).filter((x) => !x.entry.skipped);
  const name = ex?.name ?? history[0]?.entry.name ?? 'Übung';
  ctx.top({ title: name, back: true });

  if (!history.length) {
    ctx.main.append(h('div', { class: 'empty' }, 'Für diese Übung gibt es noch keine Einträge.'));
  } else {
    const oldestFirst = [...history].reverse();
    const valuePoints = oldestFirst
      .map(({ entry, training }) => ({ date: training.date, value: entryValue(entry), unit: entryValueUnit(entry) }))
      .filter((p) => p.value != null);
    // Wechselt die Einheit (z.B. erst ohne, dann mit Gewicht), zählt die häufigste.
    const unit = mostCommon(valuePoints.map((p) => p.unit));
    const points = valuePoints.filter((p) => p.unit === unit);
    const label = unit === 'kg' ? (history[0].entry.assisted ? 'Unterstützung in kg, weniger ist besser' : 'Gewicht, bester Satz')
      : unit === 's' ? 'Haltezeit, bester Satz' : 'Wiederholungen, bester Satz';

    if (points.length) {
      ctx.main.append(h('section', { class: 'card' },
        h('h2', null, label),
        lineChart(points, { label: `${label} über die Zeit`, unit: unit === 'Wdh.' ? 'Wdh.' : unit })));
    }

    const kneePoints = oldestFirst
      .filter(({ entry }) => entry.kneeCheck && entry.knee)
      .map(({ entry, training, check }) => ({ date: training.date, value: entry.knee.pain ?? 0, status: effectiveColor(entry, check) }));
    if (kneePoints.length) {
      ctx.main.append(h('section', { class: 'card' },
        h('h2', null, 'Knieschmerz bei dieser Übung'),
        lineChart(kneePoints, kneeChartOpts('Knieschmerz bei dieser Übung über die Zeit'))));
    }

    ctx.main.append(h('h2', { class: 'list-head' }, 'Alle Einträge'), h('div', { class: 'list' }, history.map(({ entry, training, check }) => {
      const color = effectiveColor(entry, check);
      return h('a', { class: 'list-row', href: `#/verlauf/training/${training.id}` },
        h('span', { class: 'list-date' }, fmtDateShort(training.date)),
        h('span', { class: 'list-main' }, h('span', { class: 'list-title' }, fmtSets(entry))),
        color ? statusBadge(color, `${AMPEL[color].label} ${entry.knee.pain ?? ''}`.trim()) : null);
    })));
  }

  if (ex) ctx.main.append(h('a', { class: 'btn secondary block', href: `#/plan/uebung/${ex.id}` }, icon('edit'), 'Übung im Plan bearbeiten'));
}

function mostCommon(list) {
  const counts = new Map();
  for (const x of list) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function kneeChartOpts(label) {
  return {
    label,
    yMin: 0,
    yMax: 10,
    step: 2,
    // Bandgrenzen zwischen den ganzen Zahlen, passend zu ampelColor: 0–2, 3–4, ab 5.
    bands: [
      { from: 0, to: 2.5, status: 'gruen', label: 'Grün' },
      { from: 2.5, to: 4.5, status: 'gelb', label: 'Gelb' },
      { from: 4.5, to: 10, status: 'rot', label: 'Rot' },
    ],
  };
}

// ---------------------------------------------------------------- Knie

function kneeTab(ctx) {
  const series = [...store.trainings()].reverse()
    .map((t) => ({ t, knee: trainingKnee(t, store.checkFor(t.date)) }))
    .filter((x) => x.knee)
    .map(({ t, knee }) => ({ date: t.date, value: knee.pain, status: knee.color, detail: t.title }));

  ctx.main.append(h('section', { class: 'card' },
    h('h2', null, 'Höchster Knieschmerz pro Training'),
    series.length
      ? lineChart(series, kneeChartOpts('Höchster Knieschmerz pro Training über die Zeit'))
      : h('p', { class: 'muted' }, 'Noch keine Knie-Ampel eingetragen.')));

  const checks = store.kneeChecks();
  if (checks.length) {
    ctx.main.append(h('h2', { class: 'list-head' }, 'Kniecheck am Folgetag'), h('div', { class: 'list' }, checks.map((c) => {
      const parts = [c.schlimmer ? 'schlimmer' : 'nicht schlimmer', c.schwellung ? 'mehr Schwellung' : 'keine zusätzliche Schwellung', c.stroke ? `Stroke-Test ${c.stroke}` : null];
      return h('div', { class: 'list-row' },
        h('span', { class: 'list-date' }, fmtDateShort(c.date)),
        h('span', { class: 'list-main' }, h('span', { class: 'list-meta' }, parts.filter(Boolean).join(', '))),
        statusBadge(morningColor(c)));
    })));
  }

  readinessCard(ctx);
  measurementsSection(ctx);
}

// ---------------------------------------------------------------- Bereit zur OP

function readinessCard(ctx) {
  const items = opReadiness(store.measurements());
  const done = items.filter((x) => x.ok === true).length;
  ctx.main.append(h('section', { class: 'card' },
    h('h2', null, `Bereit zur OP: ${done} von ${items.length}`),
    h('p', { class: 'muted small' }, 'Kriterien aus Delaware-Oslo und Leitlinie. Die Werte kommen aus den Messungen unten, je Kriterium die neueste.'),
    h('div', { class: 'readiness' }, items.map((x) => h('div', { class: 'readiness-row' },
      x.ok === true ? statusBadge('gruen', 'erfüllt') : x.ok === false ? statusBadge('gelb', 'offen') : h('span', { class: 'status muted' }, 'nicht gemessen'),
      h('span', { class: 'readiness-label' }, x.label),
      h('span', { class: 'readiness-value muted' }, x.value ?? ''))))));
}

// ---------------------------------------------------------------- Messwerte vom Physio

function measurementsSection(ctx) {
  const list = store.measurements();
  ctx.main.append(h('div', { class: 'section-head' },
    h('h2', { class: 'list-head' }, 'Messwerte vom Physio'),
    h('button', { class: 'btn small secondary', onclick: () => editMeasurement(ctx) }, icon('plus'), 'Neu')));

  const lsi = [...list].reverse().filter((m) => m.lsi != null).map((m) => ({ date: m.date, value: m.lsi }));
  if (lsi.length >= 2) {
    ctx.main.append(h('section', { class: 'card' },
      h('h2', null, 'Quadrizeps im Seitenvergleich'),
      h('p', { class: 'muted small' }, 'Ziel vor der Kreuzband-OP: mindestens 80 Prozent.'),
      lineChart(lsi, { label: 'Quadrizepskraft im Seitenvergleich in Prozent', unit: '%' })));
  }

  if (!list.length) {
    ctx.main.append(h('p', { class: 'muted' }, 'Streckung, Beugung, Kraft im Seitenvergleich und Schwellung, wenn der Physio misst.'));
    return;
  }
  ctx.main.append(h('div', { class: 'list' }, list.map((m) => h('button', { class: 'list-row', onclick: () => editMeasurement(ctx, m) },
    h('span', { class: 'list-date' }, fmtDateShort(m.date)),
    h('span', { class: 'list-main' }, h('span', { class: 'list-meta' }, measurementText(m))),
    icon('edit', 'chev')))));
}

function measurementText(m) {
  return [
    m.streckdefizit != null ? `Streckdefizit ${formatNum(m.streckdefizit)}°` : null,
    m.beugung != null ? `Beugung ${formatNum(m.beugung)}°` : null,
    m.lsi != null ? `Kraft ${formatNum(m.lsi)} %` : null,
    m.stroke ? `Stroke-Test ${m.stroke}` : null,
    m.slrOk != null ? `Beinheben ${m.slrOk ? 'ohne' : 'mit'} Streckdefizit` : null,
    m.gangOk != null ? `Gangbild ${m.gangOk ? 'normal' : 'auffällig'}` : null,
    m.standOk != null ? `Einbeinstand ${m.standOk ? 'über' : 'unter'} 30 s` : null,
    m.note || null,
  ].filter(Boolean).join(' · ') || 'ohne Werte';
}

/** Ja/Nein/nicht geprüft als Auswahl. Schreibt true, false oder null in m[key]. */
function yesNoSelect(m, key, label) {
  const sel = h('select', { 'aria-label': label },
    h('option', { value: '', selected: m[key] == null }, 'nicht geprüft'),
    h('option', { value: 'ja', selected: m[key] === true }, 'ja'),
    h('option', { value: 'nein', selected: m[key] === false }, 'nein'));
  sel.addEventListener('change', () => { m[key] = sel.value === '' ? null : sel.value === 'ja'; });
  return sel;
}

function editMeasurement(ctx, existing = null) {
  const m = existing
    ? { slrOk: null, gangOk: null, standOk: null, ...existing }
    : { id: store.uid('m'), date: dateKey(), streckdefizit: null, beugung: null, lsi: null, stroke: '', slrOk: null, gangOk: null, standOk: null, note: '' };
  const strokeSel = h('select', { 'aria-label': 'Stroke-Test' },
    h('option', { value: '' }, 'nicht gemessen'),
    STROKE_GRADES.map((g) => h('option', { value: g, selected: m.stroke === g }, g)));
  strokeSel.addEventListener('change', () => { m.stroke = strokeSel.value; });

  const actions = [
    existing ? { label: 'Löschen', kind: 'danger-text', onClick: async (close) => {
      close();
      if (await confirmDialog('Diese Messung löschen?', { ok: 'Löschen', danger: true })) {
        await store.deleteMeasurement(m.id);
        ctx.refresh();
      }
    } } : null,
    { label: 'Speichern', kind: 'primary', onClick: async (close) => {
      if (await store.saveMeasurement(m)) {
        close();
        toast('Messung gespeichert');
        ctx.refresh();
      }
    } },
  ].filter(Boolean);

  openSheet({
    title: existing ? 'Messung bearbeiten' : 'Neue Messung',
    body: h('div', { class: 'form-grid' },
      field('Datum', h('input', { type: 'date', value: m.date, onchange: (e) => { if (e.target.value) m.date = e.target.value; } })),
      h('div', { class: 'form-row' },
        field('Streckdefizit (Grad)', numberInput({ label: 'Streckdefizit in Grad', value: formatNum(m.streckdefizit), onInput: (v) => { m.streckdefizit = parseNum(v); } }), '0 = volle Streckung'),
        field('Beugung (Grad)', numberInput({ label: 'Beugung in Grad', value: formatNum(m.beugung), onInput: (v) => { m.beugung = parseNum(v); } }))),
      h('div', { class: 'form-row' },
        field('Kraft (%)', numberInput({ label: 'Quadrizepskraft im Seitenvergleich in Prozent', value: formatNum(m.lsi), onInput: (v) => { m.lsi = parseNum(v); } }), 'operiert geteilt durch gesund'),
        field('Stroke-Test', strokeSel)),
      field('Gerades Beinheben ohne Streckdefizit', yesNoSelect(m, 'slrOk', 'Gerades Beinheben ohne Streckdefizit')),
      h('div', { class: 'form-row' },
        field('Gangbild normal', yesNoSelect(m, 'gangOk', 'Gangbild normal')),
        field('Einbeinstand über 30 s', yesNoSelect(m, 'standOk', 'Einbeinstand über 30 Sekunden'))),
      field('Notiz', h('textarea', { rows: 2, value: m.note ?? '', oninput: (e) => { m.note = e.target.value; } }))),
    actions,
  });
}
