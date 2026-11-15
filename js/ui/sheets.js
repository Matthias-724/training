// Wiederkehrende Dialoge: Knie-Ampel, Kniecheck am Morgen, Infoblatt.

import { h, openSheet } from './dom.js';
import {
  AMPEL, KNEE_FLAGS, STROKE_GRADES, MORNING_TEXT, ZONE2_HINT,
  ampelColor, morningVerdict, morningColor, dateKey,
} from '../logic.js';
import { fmtDateShort } from '../format.js';
import * as store from '../store.js';

/** Farbpunkt mit Text. Die Farbe trägt nie allein die Bedeutung. */
export function statusBadge(color, text = AMPEL[color]?.label) {
  if (!color) return null;
  return h('span', { class: `status s-${color}` }, h('span', { class: 'status-dot', 'aria-hidden': 'true' }), text);
}

function pressButton(label, pressed, onClick, cls = '') {
  return h('button', { class: `chip ${cls}`.trim(), 'aria-pressed': String(pressed), type: 'button', onclick: onClick }, label);
}

// ---------------------------------------------------------------- Knie-Ampel nach einer Übung

/** Fragt den Knieschmerz ab. Liefert { pain, flags, color } oder null bei Abbruch. */
export function rateKnee(exerciseName, initial = null) {
  return new Promise((resolve) => {
    let pain = initial?.pain ?? null;
    const flags = { ...Object.fromEntries(Object.keys(KNEE_FLAGS).map((k) => [k, false])), ...(initial?.flags ?? {}) };

    const grid = h('div', { class: 'pain-grid', role: 'group', 'aria-label': 'Schmerz von 0 bis 10' });
    const flagBox = h('div', { class: 'chip-row', role: 'group', 'aria-label': 'Warnzeichen' });
    const result = h('div', { class: 'ampel-result', 'aria-live': 'polite' });

    let sheet;
    const save = h('button', { class: 'btn primary', onclick: () => sheet.close('save') }, 'Übernehmen');

    function render() {
      grid.replaceChildren(...Array.from({ length: 11 }, (_, i) =>
        pressButton(String(i), pain === i, () => { pain = i; render(); }, `pain z-${ampelColor(i)}`)));
      flagBox.replaceChildren(...Object.entries(KNEE_FLAGS).map(([k, label]) =>
        pressButton(label, flags[k], () => { flags[k] = !flags[k]; render(); }, 'flag')));
      const color = ampelColor(pain, flags);
      save.disabled = color == null;
      result.replaceChildren();
      if (color) {
        result.className = `ampel-result r-${color}`;
        result.append(statusBadge(color), h('p', null, AMPEL[color].rule));
        if (color === 'rot') {
          const warn = Object.values(flags).some(Boolean);
          result.append(h('p', { class: 'muted' }, warn
            ? 'Die Übung wird pausiert. Bei Blockade oder Wegknicken vor dem nächsten Mal ärztlich abklären.'
            : 'Die Übung wird pausiert. Beim nächsten Mal mit weniger Last freigeben oder eine Ersatzübung machen.'));
        }
      } else {
        result.className = 'ampel-result';
        result.append(h('p', { class: 'muted' }, 'Schmerzwert wählen.'));
      }
    }

    sheet = openSheet({
      title: 'Knie-Ampel',
      body: [
        h('p', { class: 'sheet-sub' }, exerciseName),
        h('h3', { class: 'sheet-label' }, 'Schmerz während der Übung'),
        h('div', { class: 'pain-scale', 'aria-hidden': 'true' }, h('span', null, 'kein'), h('span', null, 'stärkster')),
        grid,
        h('h3', { class: 'sheet-label' }, 'Warnzeichen'),
        flagBox,
        result,
      ],
      onClose: (v) => {
        if (v !== 'save') return resolve(null);
        resolve({ pain, flags: { ...flags }, color: ampelColor(pain, flags) });
      },
    });
    sheet.el.querySelector('.sheet-body').after(h('div', { class: 'sheet-actions' }, save));
    render();
  });
}

// ---------------------------------------------------------------- Kniecheck am Folgetag

/** Fragt am Morgen nach einem Beintraining nach. Speichert selbst, liefert den Check oder null. */
export function morningCheck(refDate) {
  return new Promise((resolve) => {
    const answer = { schlimmer: null, schwellung: null, stroke: '' };
    const q1 = h('div', { class: 'seg', role: 'group', 'aria-label': 'Knie schlimmer als gestern' });
    const q2 = h('div', { class: 'seg', role: 'group', 'aria-label': 'Schwellung' });
    const q3 = h('div', { class: 'chip-row', role: 'group', 'aria-label': 'Stroke-Test' });
    const result = h('div', { class: 'ampel-result', 'aria-live': 'polite' });
    let sheet;
    const save = h('button', { class: 'btn primary', onclick: () => sheet.close('save') }, 'Speichern');

    function yesNo(box, key) {
      box.replaceChildren(
        pressButton('Nein', answer[key] === false, () => { answer[key] = false; render(); }),
        pressButton('Ja', answer[key] === true, () => { answer[key] = true; render(); }));
    }

    function render() {
      yesNo(q1, 'schlimmer');
      yesNo(q2, 'schwellung');
      q3.replaceChildren(
        pressButton('nicht gemessen', answer.stroke === '', () => { answer.stroke = ''; render(); }),
        ...STROKE_GRADES.map((g) => pressButton(g, answer.stroke === g, () => { answer.stroke = g; render(); })));
      const complete = answer.schlimmer != null && answer.schwellung != null;
      save.disabled = !complete;
      result.replaceChildren();
      result.className = 'ampel-result';
      result.hidden = !complete;
      if (complete) {
        const v = morningVerdict(answer);
        const color = morningColor(answer);
        result.className = `ampel-result r-${color}`;
        result.append(statusBadge(color), h('p', null, MORNING_TEXT[v]));
      }
    }

    sheet = openSheet({
      title: 'Kniecheck',
      body: [
        h('p', { class: 'sheet-sub' }, `Bezogen auf das Beintraining am ${fmtDateShort(refDate)}`),
        h('h3', { class: 'sheet-label' }, 'Knie heute schlimmer als gestern?'), q1,
        h('h3', { class: 'sheet-label' }, 'Mehr Schwellung als gestern?'), q2,
        h('h3', { class: 'sheet-label' }, 'Stroke-Test, falls gemacht'), q3,
        result,
      ],
      onClose: async (v) => {
        if (v !== 'save') return resolve(null);
        const check = { id: store.uid('kc'), date: dateKey(), refDate, ...answer };
        await store.saveKneeCheck(check);
        resolve(check);
      },
    });
    sheet.el.querySelector('.sheet-body').after(h('div', { class: 'sheet-actions' },
      h('button', { class: 'btn secondary', onclick: () => sheet.close() }, 'Später'), save));
    render();
  });
}

// ---------------------------------------------------------------- Infoblatt

export function infoSheet() {
  const phase = store.activePhase();
  openSheet({
    title: 'Info',
    cls: 'tall',
    body: [
      h('h3', { class: 'sheet-label' }, 'Tabu bis zur zweiten OP'),
      h('ul', { class: 'tabu-list' }, store.tabu().map((t) => h('li', null, t))),
      h('h3', { class: 'sheet-label' }, 'Knie-Ampel'),
      h('div', { class: 'ampel-table' }, ampelRow('gruen'), ampelRow('gelb'), ampelRow('rot')),
      h('p', { class: 'sheet-text muted' }, 'Schmerz und Schwellung dürfen von Woche zu Woche nicht zunehmen.'),
      h('h3', { class: 'sheet-label' }, 'Zone 2'),
      h('p', { class: 'sheet-text' }, ZONE2_HINT),
      h('h3', { class: 'sheet-label' }, `${phase.name}: ${phase.title}`),
      h('p', { class: 'sheet-text' }, phase.hint),
    ],
  });
}

function ampelRow(color) {
  return h('div', { class: 'ampel-row' },
    statusBadge(color),
    h('div', null, h('div', null, AMPEL[color].sign), h('div', { class: 'muted' }, AMPEL[color].rule)));
}

/** Hinweistext beim Phasenwechsel. */
export function phaseHintSheet(phase) {
  return new Promise((resolve) => {
    openSheet({
      title: `${phase.name}: ${phase.title}`,
      body: h('p', { class: 'sheet-text' }, phase.hint),
      actions: [{ label: 'Verstanden', kind: 'primary', value: true }],
      onClose: () => resolve(),
    });
  });
}
