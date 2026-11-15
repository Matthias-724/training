// Heute-Ansicht: was laut Wochenplan heute dran ist, offene Hinweise und die Woche.

import { h, icon, choose, confirmDialog, toast } from '../ui/dom.js';
import { SEED_VERSION } from '../seed.js';
import {
  dateKey, weekdayOf, weekStart, addDays, resolveDay, dayTitle, cardioSummary, formatTarget,
  progressionHint, pendingMorningCheck, backupStatus, phaseIsEmpty, trainingKnee, worseColor,
  WEEKDAYS, WEEKDAY_SHORT,
} from '../logic.js';
import { fmtDateLong, fmtTime, fmtDaysAgo } from '../format.js';
import * as store from '../store.js';
import { startTraining } from './training.js';
import { morningCheck, statusBadge } from '../ui/sheets.js';
import { exportBackup } from '../backup.js';
import { isIos, isStandalone } from '../ui/device.js';

export function render(ctx) {
  const today = dateKey();
  const phase = store.activePhase();
  const examMode = store.meta('examMode', false);
  const day = resolveDay(phase, weekdayOf(today), examMode);
  const unit = day.unitId ? store.unit(day.unitId) : null;

  ctx.top({ title: 'Heute' });

  ctx.main.append(
    h('div', { class: 'today-head' },
      h('div', { class: 'today-date' }, fmtDateLong(today)),
      h('div', { class: 'chip-row' },
        h('a', { class: 'chip static', href: '#/mehr' }, `${phase.name}: ${phase.title}`),
        examMode ? h('a', { class: 'chip static warn', href: '#/mehr' }, 'Klausurmodus') : null)),
    ...banners(ctx, today));

  if (phaseIsEmpty(phase)) {
    ctx.main.append(h('section', { class: 'card' },
      h('h2', null, 'Noch kein Plan'),
      h('p', null, `Für ${phase.name} ist noch nichts eingetragen. Den Plan mit dem Physio unter "Plan" füllen.`),
      h('a', { class: 'btn primary block', href: '#/plan' }, 'Zum Plan')));
  } else {
    ctx.main.append(dayCard(ctx, day, unit, today));
  }
  const daily = dailyCard(ctx, phase, today);
  if (daily) ctx.main.append(daily);

  ctx.main.append(
    h('div', { class: 'quick-actions' },
      h('a', { class: 'btn secondary', href: '#/ausdauer' }, 'Ausdauer eintragen'),
      h('button', { class: 'btn secondary', onclick: () => otherUnit(ctx) }, 'Andere Einheit')),
    weekCard(ctx, phase, examMode, today));
}

// ---------------------------------------------------------------- Hinweise oben

function banners(ctx, today) {
  const out = [];
  const draft = store.draft();
  if (draft) {
    out.push(h('div', { class: 'banner accent' },
      h('div', null, h('strong', null, 'Training läuft'), h('div', null, `${draft.title}, seit ${fmtTime(draft.startedAt)}`)),
      h('a', { class: 'btn primary small', href: '#/training' }, 'Fortsetzen')));
  }

  const refDate = pendingMorningCheck(store.trainings(), store.kneeChecks(), today);
  if (refDate) {
    out.push(h('div', { class: 'banner warn' },
      h('div', null, h('strong', null, 'Kniecheck'), h('div', null, 'Gestern war Beintraining. Wie geht es dem Knie heute?')),
      h('button', { class: 'btn primary small', onclick: async () => { if (await morningCheck(refDate)) ctx.refresh(); } }, 'Beantworten')));
  }

  if (store.seedUpdateAvailable() && store.meta('seedUpdateLater') !== SEED_VERSION) {
    out.push(h('div', { class: 'banner accent' },
      h('div', null,
        h('strong', null, 'Überarbeiteter Trainingsplan'),
        h('div', null, 'Nach der Prehab-Studienlage: tägliche Streckung, neue Beintage, strengere Knie-Ampel.')),
      h('div', { class: 'banner-actions' },
        h('button', { class: 'btn primary small', onclick: () => offerSeedUpdate(ctx) }, 'Ansehen'),
        h('button', { class: 'btn secondary small', onclick: () => { store.setMeta('seedUpdateLater', SEED_VERSION); ctx.refresh(); } }, 'Später'))));
  }

  const backup = backupStatus(store.meta('lastBackupAt'), store.meta('installedAt'), Date.now());
  if (backup.due) {
    out.push(h('div', { class: 'banner warn' },
      h('div', null,
        h('strong', null, 'Backup fällig'),
        h('div', null, backup.never ? 'Noch kein Backup gemacht. iOS kann Website-Daten löschen.' : `Letztes Backup ${fmtDaysAgo(backup.days)}.`)),
      h('button', { class: 'btn primary small', onclick: async () => { if (await exportBackup()) ctx.refresh(); } }, 'Sichern')));
  }

  if (isIos() && !isStandalone() && !store.meta('installHintHidden')) {
    out.push(h('div', { class: 'banner' },
      h('div', null,
        h('strong', null, 'Auf den Home-Bildschirm legen'),
        h('div', null, 'In Safari auf Teilen tippen, dann "Zum Home-Bildschirm". Erst danach Trainings eintragen: Safari und die installierte App haben getrennte Speicher.')),
      h('button', { class: 'btn secondary small', onclick: () => { store.setMeta('installHintHidden', true); ctx.refresh(); } }, 'Ausblenden')));
  }
  return out;
}

/** Erklärt das Plan-Update und übernimmt es auf Wunsch. Auch von "Mehr" aus genutzt. */
export async function offerSeedUpdate(ctx) {
  const ok = await confirmDialog(
    'Neu: jeden Tag Streckung und Quadrizeps-Aktivierung als eigene Einheit. Beintage Dienstag und Freitag mit Störungstraining am Anfang, eigenen schweren Sätzen fürs gesunde Bein, 4 Sätzen Beinpresse und Kniestrecker und Hüftaußenrotation. Donnerstag nur noch Rad, Core und Mobilität. Startübungen, Starteinheiten und Wochenpläne werden ersetzt, eigene Änderungen daran gehen verloren. Eigene Übungen, Pausierungen, freigeschaltete Phasen und der Verlauf bleiben.',
    { title: 'Neuen Plan übernehmen', ok: 'Übernehmen' });
  if (!ok) return;
  await store.applySeedUpdate();
  toast('Neuer Plan übernommen');
  ctx.refresh();
}

/** Tägliche Einheit der Phase, unabhängig vom Wochentag und vom Klausurmodus. */
function dailyCard(ctx, phase, today) {
  const u = store.dailyUnit(phase);
  if (!u) return null;
  const done = store.trainingsOn(today).filter((t) => t.unitId === u.id);
  return h('section', { class: 'card day-card' },
    h('div', { class: 'day-card-head' },
      h('h2', null, u.name),
      done.length ? h('span', { class: 'badge good' }, `erledigt ${fmtTime(done[0].finishedAt ?? done[0].startedAt)}`) : null),
    u.hint ? h('p', { class: 'muted small' }, u.hint) : null,
    h('ol', { class: 'ex-list' }, u.exerciseIds.map(exerciseLine)),
    h('button', {
      class: `btn ${done.length ? 'secondary' : 'primary'} block`,
      onclick: () => startTraining(ctx, { unitId: u.id, title: u.name }),
    }, icon('play'), done.length ? 'Noch einmal starten' : 'Starten'));
}

/** Trainings eines Tages ohne die tägliche Einheit, damit sie nicht als Tagestraining zählt. */
function mainTrainingsOn(date) {
  const dailyId = store.activePhase().dailyUnitId;
  return store.trainingsOn(date).filter((t) => !dailyId || t.unitId !== dailyId);
}

// ---------------------------------------------------------------- Heutige Einheit

function exerciseLine(id) {
  const ex = store.exercise(id);
  if (!ex) return null;
  const badges = [];
  if (ex.paused) badges.push(h('span', { class: 'badge bad' }, 'pausiert'));
  else if (progressionHint(store.historyFor(id))) badges.push(h('span', { class: 'badge good' }, 'steigern'));
  return h('li', { class: `ex-line ${ex.paused ? 'muted' : ''}` },
    h('span', { class: 'ex-name' }, ex.name),
    h('span', { class: 'ex-meta' }, formatTarget(ex), ...badges));
}

/** Karte mit Ausdauerblöcken, Übungsliste und Start-Knopf. Auch für andere Wochentage nutzbar. */
export function dayCard(ctx, day, unit, dateForDone) {
  const card = h('section', { class: 'card day-card' });
  const title = dayTitle(day, unit?.name);
  const doneToday = dateForDone ? mainTrainingsOn(dateForDone) : [];

  card.append(h('div', { class: 'day-card-head' },
    h('h2', null, title),
    doneToday.length ? h('span', { class: 'badge good' }, `erledigt ${fmtTime(doneToday[0].finishedAt ?? doneToday[0].startedAt)}`) : null));

  if (day.rest) {
    card.append(h('p', { class: 'muted' }, day.exam ? 'Im Klausurmodus bleiben nur Montag, Dienstag und Freitag.' : 'Heute ist kein Training geplant.'));
    return card;
  }

  if (day.before) card.append(h('p', { class: 'cardio-line' }, icon('bike'), `Davor: ${cardioSummary(day.before)}`));
  if (unit?.exerciseIds.length) {
    card.append(h('ol', { class: 'ex-list' }, unit.exerciseIds.map(exerciseLine)));
  } else if (unit) {
    card.append(h('p', { class: 'muted' }, 'Noch keine Übungen eingetragen. ', h('a', { href: `#/plan/einheit/${unit.id}` }, 'Im Plan ergänzen')));
  }
  if (day.after) card.append(h('p', { class: 'cardio-line' }, icon('bike'), `Danach: ${cardioSummary(day.after)}`));
  if (day.note) card.append(h('p', { class: 'muted' }, day.note));

  const canStart = (unit?.exerciseIds.length ?? 0) > 0 || day.before || day.after;
  if (canStart) {
    card.append(h('button', {
      class: `btn ${doneToday.length ? 'secondary' : 'primary'} block big`,
      onclick: () => startTraining(ctx, { unitId: day.unitId, before: day.before, after: day.after, title }),
    }, icon('play'), doneToday.length ? 'Noch einmal starten' : 'Training starten'));
  }
  return card;
}

async function otherUnit(ctx) {
  const phase = store.activePhase();
  const planned = new Set(Object.values(phase.weekplan).map((d) => d.unitId).filter(Boolean));
  const units = store.allUnits().filter((u) => u.exerciseIds.length);
  units.sort((a, b) => Number(planned.has(b.id)) - Number(planned.has(a.id)));
  const id = await choose('Andere Einheit starten', units.map((u) => ({
    label: u.name,
    value: u.id,
    detail: `${u.exerciseIds.length} Übungen${planned.has(u.id) ? '' : ', nicht in dieser Phase geplant'}`,
  })));
  if (id) startTraining(ctx, { unitId: id });
}

// ---------------------------------------------------------------- Woche

function weekCard(ctx, phase, examMode, today) {
  const start = weekStart(today);
  const rows = WEEKDAYS.map((wd, i) => {
    const date = addDays(start, i);
    const day = resolveDay(phase, wd, examMode);
    const unit = day.unitId ? store.unit(day.unitId) : null;
    const done = mainTrainingsOn(date);
    // Farbe inklusive Kniecheck vom Folgetag, damit Woche und Verlauf dasselbe zeigen.
    const worst = done.map((t) => trainingKnee(t, store.checkFor(t.date))?.color ?? null).reduce(worseColor, null);
    return h('button', {
      class: `week-row ${date === today ? 'today' : ''} ${day.rest ? 'rest' : ''}`,
      onclick: () => weekDaySheet(ctx, day, unit),
      disabled: day.rest,
    },
      h('span', { class: 'week-day' }, WEEKDAY_SHORT[wd]),
      h('span', { class: 'week-title' }, dayTitle(day, unit?.name)),
      h('span', { class: 'week-state' },
        done.length ? h('span', { class: 'done-mark', 'aria-label': 'erledigt' }, icon('check')) : null,
        worst ? statusBadge(worst) : null));
  });
  return h('section', { class: 'card' }, h('h2', null, 'Diese Woche'), h('div', { class: 'week' }, rows));
}

async function weekDaySheet(ctx, day, unit) {
  const title = dayTitle(day, unit?.name);
  const lines = [day.before ? `Davor: ${cardioSummary(day.before)}` : null,
    unit ? `${unit.exerciseIds.length} Übungen` : null,
    day.after ? `Danach: ${cardioSummary(day.after)}` : null].filter(Boolean).join('. ');
  const v = await choose(title, [{ label: 'Jetzt starten', value: 'start', kind: 'primary' }], lines);
  if (v === 'start') startTraining(ctx, { unitId: day.unitId, before: day.before, after: day.after, title });
}
