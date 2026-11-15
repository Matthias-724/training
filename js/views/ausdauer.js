// Ausdauer-Einheiten: Formularfelder (auch im Trainingsmodus genutzt) und
// die eigenständige Seite zum Eintragen und Bearbeiten.

import { h, field, numberInput, select, confirmDialog, toast } from '../ui/dom.js';
import { CARDIO_TYPES, dateKey, parseNum, formatNum } from '../logic.js';
import * as store from '../store.js';

/**
 * Felder für Art, Dauer, Puls, Watt und Notiz. Schreibt direkt in log.
 * preferredTypes kommen aus dem Plan und stehen in der Auswahl oben.
 */
export function cardioFields(log, onChange, preferredTypes = []) {
  const order = [...new Set([...preferredTypes, ...Object.keys(CARDIO_TYPES)])];
  const changed = () => onChange?.(log);
  return h('div', { class: 'form-grid' },
    field('Art', select({
      label: 'Art',
      value: log.type,
      options: order.map((t) => ({ value: t, label: CARDIO_TYPES[t] })),
      onChange: (v) => { log.type = v; changed(); },
    })),
    h('div', { class: 'form-row' },
      field('Dauer (min)', numberInput({ label: 'Dauer in Minuten', value: formatNum(log.minutes), decimal: false, onInput: (v) => { log.minutes = parseNum(v); changed(); } })),
      field('Puls (optional)', numberInput({ label: 'Durchschnittspuls', value: formatNum(log.puls), decimal: false, onInput: (v) => { log.puls = parseNum(v); changed(); } })),
      field('Watt (optional)', numberInput({ label: 'Durchschnittliche Leistung', value: formatNum(log.watt), decimal: false, onInput: (v) => { log.watt = parseNum(v); changed(); } }))),
    field('Notiz', h('textarea', {
      rows: 2,
      value: log.note ?? '',
      oninput: (e) => { log.note = e.target.value; changed(); },
    })));
}

/** Seite #/ausdauer (neu) oder #/ausdauer/:id (bearbeiten). */
export function render(ctx) {
  const [id] = ctx.params;
  const existing = id ? store.cardioLog(id) : null;
  if (id && !existing) return ctx.replace('/verlauf/trainings');

  const log = existing
    ? { ...existing }
    : { id: store.uid('c'), date: dateKey(), startedAt: Date.now(), trainingId: null, type: 'rad_indoor', minutes: null, puls: null, watt: null, note: '' };

  ctx.top({ title: existing ? 'Ausdauer bearbeiten' : 'Ausdauer eintragen', back: true });

  const dateInput = h('input', { type: 'date', value: log.date, max: dateKey(), onchange: (e) => { if (e.target.value) log.date = e.target.value; } });

  async function save() {
    if (!log.minutes || log.minutes <= 0) {
      toast('Bitte die Dauer eintragen.');
      return;
    }
    if (await store.saveCardio(log)) {
      toast('Ausdauer gespeichert');
      ctx.back('/heute');
    }
  }

  async function remove() {
    if (!await confirmDialog('Diese Ausdauer-Einheit löschen?', { ok: 'Löschen', danger: true })) return;
    if (await store.deleteCardio(log.id)) ctx.back('/verlauf/trainings');
  }

  ctx.main.append(
    h('section', { class: 'card' },
      field('Datum', dateInput),
      cardioFields(log, null, [log.type])),
    h('div', { class: 'stack' },
      h('button', { class: 'btn primary block', onclick: save }, 'Speichern'),
      existing && !existing.trainingId ? h('button', { class: 'btn danger-text block', onclick: remove }, 'Löschen') : null,
      existing?.trainingId ? h('p', { class: 'muted small' }, 'Gehört zu einem Training. Löschen über das Training im Verlauf.') : null));
}
