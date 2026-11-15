// Pausentimer und Countdown für Halteübungen.
//
// Beide rechnen mit einem festen Endzeitpunkt statt mit gezählten Ticks.
// iOS hält Timer an, sobald die App im Hintergrund ist. Mit dem Endzeitpunkt
// stimmt die Anzeige trotzdem, sobald die App wieder vorne ist.

import { h, icon } from './dom.js';
import { endSignal, tick, beep } from './device.js';
import { fmtClock } from '../format.js';

// ---------------------------------------------------------------- Pausentimer

const rest = { el: null, endAt: 0, total: 0, interval: null, finished: false, lastTick: null, hideTimer: null };

function restBar() {
  if (rest.el) return rest.el;
  const time = h('span', { class: 'rest-time' });
  const label = h('span', { class: 'rest-label' }, 'Pause');
  const fill = h('span', { class: 'rest-fill' });
  rest.el = h('div', { id: 'rest-timer', role: 'timer', 'aria-live': 'off' },
    h('span', { class: 'rest-progress', 'aria-hidden': 'true' }, fill),
    h('div', { class: 'rest-main' }, label, time),
    h('div', { class: 'rest-buttons' },
      h('button', { class: 'rest-btn', onclick: () => adjustRest(-15), 'aria-label': '15 Sekunden weniger' }, '−15'),
      h('button', { class: 'rest-btn', onclick: () => adjustRest(15), 'aria-label': '15 Sekunden mehr' }, '+15'),
      h('button', { class: 'rest-btn', onclick: stopRest, 'aria-label': 'Pause beenden' }, icon('close'))));
  rest.el._time = time;
  rest.el._label = label;
  rest.el._fill = fill;
  document.body.append(rest.el);
  return rest.el;
}

export function startRest(seconds) {
  if (!seconds || seconds <= 0) return;
  const el = restBar();
  rest.total = seconds;
  rest.endAt = Date.now() + seconds * 1000;
  rest.finished = false;
  rest.lastTick = null;
  clearTimeout(rest.hideTimer);
  el.classList.remove('done');
  el.classList.add('visible');
  document.body.classList.add('rest-active');
  clearInterval(rest.interval);
  rest.interval = setInterval(updateRest, 250);
  updateRest();
}

export function stopRest() {
  clearInterval(rest.interval);
  clearTimeout(rest.hideTimer);
  rest.interval = null;
  rest.endAt = 0;
  rest.el?.classList.remove('visible', 'done');
  document.body.classList.remove('rest-active');
}

export function restRunning() {
  return rest.endAt > 0 && !rest.finished;
}

function adjustRest(delta) {
  if (!rest.endAt) return;
  rest.endAt = Math.max(Date.now() + 1000, rest.endAt + delta * 1000);
  rest.total = Math.max(rest.total + delta, 1);
  if (rest.finished) {
    rest.finished = false;
    clearTimeout(rest.hideTimer);
    rest.el.classList.remove('done');
    clearInterval(rest.interval);
    rest.interval = setInterval(updateRest, 250);
  }
  updateRest();
}

function updateRest() {
  const el = rest.el;
  if (!el || !rest.endAt) return;
  const left = (rest.endAt - Date.now()) / 1000;
  if (left <= 0) {
    if (!rest.finished) {
      rest.finished = true;
      clearInterval(rest.interval);
      el.classList.add('done');
      el._label.textContent = 'Pause vorbei';
      el._time.textContent = 'Weiter';
      el._fill.style.transform = 'scaleX(0)';
      endSignal();
      rest.hideTimer = setTimeout(stopRest, 12_000);
    }
    return;
  }
  const whole = Math.ceil(left);
  if (whole <= 3 && whole !== rest.lastTick) {
    rest.lastTick = whole;
    tick();
  }
  el._label.textContent = 'Pause';
  el._time.textContent = fmtClock(left);
  el._fill.style.transform = `scaleX(${Math.min(1, left / rest.total)})`;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') updateRest();
});

// ---------------------------------------------------------------- Halte-Countdown

const PREP_SECONDS = 5;

/**
 * Vollbild-Countdown für Halteübungen. Bei "je Seite" läuft er zweimal mit
 * einer kurzen Wechselpause. Liefert per onDone die gehaltene Zeit.
 */
export function runHold({ name, seconds, perSide, onDone }) {
  stopRest();
  const steps = [
    { kind: 'prep', dur: PREP_SECONDS, label: 'Bereit machen' },
    { kind: 'hold', dur: seconds, label: perSide ? 'Erste Seite' : 'Halten' },
  ];
  if (perSide) {
    steps.push({ kind: 'prep', dur: PREP_SECONDS, label: 'Seite wechseln' });
    steps.push({ kind: 'hold', dur: seconds, label: 'Zweite Seite' });
  }

  let index = 0;
  let stepStart = Date.now();
  let lastTick = null;
  const held = [];
  let interval = null;

  const stepLabel = h('div', { class: 'hold-step' });
  const number = h('div', { class: 'hold-number', role: 'timer' });
  const ring = h('div', { class: 'hold-ring' }, number);
  const overlay = h('div', { class: 'hold-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Countdown ${name}` },
    h('div', { class: 'hold-name' }, name),
    stepLabel,
    ring,
    h('div', { class: 'hold-actions' },
      h('button', { class: 'btn secondary', onclick: () => finish(false) }, 'Abbrechen'),
      h('button', { class: 'btn primary', onclick: () => finish(true) }, 'Fertig')));

  function finish(save) {
    clearInterval(interval);
    document.removeEventListener('visibilitychange', update);
    overlay.remove();
    if (!save) return;
    const step = steps[index];
    if (step?.kind === 'hold') held.push(Math.round((Date.now() - stepStart) / 1000));
    // Bei "je Seite" zählt die schwächere Seite.
    const result = held.length ? Math.min(...held) : 0;
    onDone(result);
  }

  function update() {
    let step = steps[index];
    let left = step.dur - (Date.now() - stepStart) / 1000;
    while (left <= 0) {
      if (step.kind === 'hold') {
        held.push(step.dur);
        endSignal();
      }
      index += 1;
      if (index >= steps.length) {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', update);
        overlay.remove();
        onDone(Math.min(...held));
        return;
      }
      stepStart += step.dur * 1000;
      step = steps[index];
      left = step.dur - (Date.now() - stepStart) / 1000;
      lastTick = null;
      if (step.kind === 'hold') beep({ freq: 990, duration: 0.25 });
    }
    const whole = Math.ceil(left);
    if (whole <= 3 && whole !== lastTick) {
      lastTick = whole;
      tick();
    }
    overlay.classList.toggle('prep', step.kind === 'prep');
    stepLabel.textContent = step.label;
    number.textContent = whole >= 60 ? fmtClock(whole) : String(whole);
    ring.style.setProperty('--p', String(1 - left / step.dur));
  }

  document.body.append(overlay);
  document.addEventListener('visibilitychange', update);
  update();
  interval = setInterval(update, 100);
}
