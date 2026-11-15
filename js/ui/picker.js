// Auswahl einer Übung aus der Bibliothek, mit Suche und Gruppen nach Kategorie.

import { h, openSheet } from './dom.js';
import { CATEGORIES } from '../seed.js';
import { formatTarget } from '../logic.js';
import * as store from '../store.js';

/**
 * Liefert die ID der gewählten Übung, 'new' für "Neue Übung anlegen" oder null.
 * preferred: IDs, die oben als Vorschläge stehen (z.B. hinterlegte Ersatzübungen).
 */
export function pickExercise({ title = 'Übung wählen', exclude = [], preferred = [], allowNew = true } = {}) {
  return new Promise((resolve) => {
    const search = h('input', { type: 'search', class: 'search', placeholder: 'Suchen', 'aria-label': 'Übung suchen', autocomplete: 'off' });
    const list = h('div', { class: 'pick-list' });
    let sheet;

    const row = (ex) => h('button', { class: 'pick-row', type: 'button', onclick: () => sheet.close(ex.id) },
      h('span', { class: 'pick-name' }, ex.name),
      h('span', { class: 'pick-meta' }, formatTarget(ex)));

    function render() {
      const q = search.value.trim().toLowerCase();
      const all = store.allExercises().filter((e) => !exclude.includes(e.id) && (!q || e.name.toLowerCase().includes(q)));
      list.replaceChildren();
      const pref = preferred.map((id) => store.exercise(id)).filter((e) => e && all.includes(e));
      if (pref.length && !q) {
        list.append(h('h3', { class: 'pick-group' }, 'Hinterlegter Ersatz'), ...pref.map(row));
      }
      for (const [cat, label] of Object.entries(CATEGORIES)) {
        const items = all.filter((e) => e.category === cat);
        if (items.length) list.append(h('h3', { class: 'pick-group' }, label), ...items.map(row));
      }
      if (!all.length) list.append(h('p', { class: 'muted' }, 'Keine passende Übung.'));
    }

    search.addEventListener('input', render);
    sheet = openSheet({
      title,
      cls: 'tall',
      body: [
        search,
        allowNew ? h('button', { class: 'btn secondary block', type: 'button', onclick: () => sheet.close('new') }, 'Neue Übung anlegen') : null,
        list,
      ],
      onClose: (v) => resolve(v ?? null),
    });
    render();
  });
}
