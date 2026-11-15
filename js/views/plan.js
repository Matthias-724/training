// Plan bearbeiten: Wochenpläne je Phase, Einheiten, Übungsbibliothek.
//
// Einheiten und Übungen werden von allen Phasen geteilt. Wer "Beine Prehab A"
// ändert, ändert sie für jede Phase, die sie eingeplant hat. Der Verlauf bleibt
// davon unberührt, weil jedes Training eine Kopie der Übungsdaten speichert.

import { h, icon, fill, field, numberInput, toggle, select, confirmDialog, choose, toast } from '../ui/dom.js';
import {
  WEEKDAYS, WEEKDAY_NAMES, CARDIO_TYPES, resolveDay, dayTitle, cardioSummary, formatTarget, parseNum, formatNum,
} from '../logic.js';
import { CATEGORIES } from '../seed.js';
import { fmtDateShort } from '../format.js';
import * as store from '../store.js';
import { pickExercise } from '../ui/picker.js';

// ---------------------------------------------------------------- Übersicht

export function renderOverview(ctx) {
  const phase = store.phase(ctx.query.get('phase')) ?? store.activePhase();
  const active = store.activePhase();
  ctx.top({ title: 'Plan' });

  ctx.main.append(field('Phase', select({
    label: 'Phase',
    value: phase.id,
    options: store.allPhases().map((p) => ({
      value: p.id,
      label: `${p.name}: ${p.title}${p.id === active.id ? ' (aktiv)' : ''}${p.locked ? ' (gesperrt)' : ''}`,
    })),
    onChange: (id) => ctx.replace(`/plan?phase=${id}`),
  })));

  if (phase.locked) {
    ctx.main.append(h('div', { class: 'box note' }, 'Diese Phase ist noch gesperrt. Freischalten unter "Mehr", sobald der Arzt sie freigibt. Bearbeiten geht schon jetzt.'));
  }
  if (store.meta('examMode', false) && phase.id === active.id) {
    ctx.main.append(h('div', { class: 'box warn' }, 'Klausurmodus ist an: In der Heute-Ansicht gelten nur Montag, Dienstag und Freitag.'));
  }

  // Wochenplan
  const week = h('div', { class: 'list' }, WEEKDAYS.map((wd) => {
    const day = resolveDay(phase, wd, false);
    const unit = day.unitId ? store.unit(day.unitId) : null;
    const extra = [day.before ? `davor ${cardioSummary(day.before)}` : null, day.after ? `danach ${cardioSummary(day.after)}` : null]
      .filter(Boolean).join(', ');
    return h('a', { class: 'list-row', href: `#/plan/tag/${phase.id}/${wd}` },
      h('span', { class: 'list-date short' }, WEEKDAY_NAMES[wd].slice(0, 2)),
      h('span', { class: 'list-main' },
        h('span', { class: `list-title ${day.rest ? 'muted' : ''}` }, dayTitle(day, unit?.name)),
        extra ? h('span', { class: 'list-meta' }, extra) : null),
      icon('next', 'chev'));
  }));
  ctx.main.append(
    h('div', { class: 'section-head' },
      h('h2', { class: 'list-head' }, 'Wochenplan'),
      h('button', { class: 'btn small secondary', onclick: () => copyWeek(ctx, phase) }, 'Kopieren von')),
    week);

  // Einheiten
  const planned = new Set(Object.values(phase.weekplan).map((d) => d.unitId).filter(Boolean));
  const units = store.allUnits();
  const unitRow = (u) => h('a', { class: 'list-row', href: `#/plan/einheit/${u.id}` },
    h('span', { class: 'list-main' },
      h('span', { class: 'list-title' }, u.name),
      h('span', { class: 'list-meta' }, `${u.exerciseIds.length} Übungen`)),
    icon('next', 'chev'));
  ctx.main.append(
    h('div', { class: 'section-head' },
      h('h2', { class: 'list-head' }, `Einheiten in ${phase.name}`),
      h('button', { class: 'btn small secondary', onclick: async () => {
        const u = store.newUnit();
        await store.saveUnit(u);
        ctx.go(`/plan/einheit/${u.id}`);
      } }, icon('plus'), 'Neu')),
    h('div', { class: 'list' }, units.filter((u) => planned.has(u.id)).map(unitRow)));
  const others = units.filter((u) => !planned.has(u.id));
  if (others.length) {
    ctx.main.append(h('h2', { class: 'list-head' }, 'Weitere Einheiten'), h('div', { class: 'list' }, others.map(unitRow)));
  }

  const all = store.allExercises();
  const paused = all.filter((e) => e.paused).length;
  ctx.main.append(h('a', { class: 'btn secondary block', href: '#/plan/uebungen' },
    `Alle Übungen (${all.length})`, paused ? h('span', { class: 'badge bad' }, `${paused} pausiert`) : null));
}

async function copyWeek(ctx, target) {
  const sourceId = await choose(`Wochenplan für ${target.name} übernehmen`,
    store.allPhases().filter((p) => p.id !== target.id).map((p) => ({ label: `${p.name}: ${p.title}`, value: p.id })),
    'Der bisherige Wochenplan dieser Phase wird ersetzt. Einheiten und Übungen bleiben, wie sie sind.');
  if (!sourceId) return;
  target.weekplan = structuredClone(store.phase(sourceId).weekplan);
  if (await store.savePhase(target)) {
    toast('Wochenplan übernommen');
    ctx.refresh();
  }
}

// ---------------------------------------------------------------- Tag bearbeiten

function cardioBlock(types = ['rad_indoor']) {
  return { types, min: 30, max: 30, zone2: false, text: '' };
}

function cardioEditor(block, redraw) {
  const typeChips = h('div', { class: 'chip-row', role: 'group', 'aria-label': 'Art' },
    Object.entries(CARDIO_TYPES).map(([id, label]) => h('button', {
      type: 'button',
      class: 'chip',
      'aria-pressed': String(block.types.includes(id)),
      onclick: () => {
        if (block.types.includes(id)) {
          if (block.types.length > 1) block.types = block.types.filter((t) => t !== id);
        } else block.types = [...block.types, id];
        redraw();
      },
    }, label)));
  return h('div', { class: 'form-grid nested' },
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Art (eine oder mehrere)'), typeChips),
    h('div', { class: 'form-row' },
      field('Minuten von', numberInput({ label: 'Minuten von', decimal: false, value: formatNum(block.min), onInput: (v) => { block.min = parseNum(v) ?? 0; } })),
      field('bis', numberInput({ label: 'Minuten bis', decimal: false, value: formatNum(block.max), onInput: (v) => { block.max = parseNum(v); } }))),
    toggle({ label: 'Zone 2', checked: block.zone2, onChange: (v) => { block.zone2 = v; } }),
    field('Zusatz', h('input', { type: 'text', value: block.text, placeholder: 'z.B. locker', oninput: (e) => { block.text = e.target.value; } })));
}

export function renderDay(ctx) {
  const [phaseId, wd] = ctx.params;
  const phase = store.phase(phaseId);
  if (!phase || !WEEKDAYS.includes(wd)) return ctx.replace('/plan');
  const day = structuredClone(phase.weekplan[wd] ?? { unitId: null, title: '', before: null, after: null, note: '' });
  ctx.top({ title: `${WEEKDAY_NAMES[wd]}, ${phase.name}`, back: `#/plan?phase=${phase.id}` });

  const form = h('div', { class: 'stack' });
  ctx.main.append(form);

  function draw() {
    fill(form,
      h('section', { class: 'card form-grid' },
        field('Einheit', select({
          label: 'Einheit',
          value: day.unitId ?? '',
          options: [{ value: '', label: 'Keine Krafteinheit' }, ...store.allUnits().map((u) => ({ value: u.id, label: u.name }))],
          onChange: (v) => { day.unitId = v || null; },
        })),
        field('Titel (optional)', h('input', { type: 'text', value: day.title ?? '', placeholder: 'sonst Name der Einheit', oninput: (e) => { day.title = e.target.value; } })),
        field('Notiz', h('input', { type: 'text', value: day.note ?? '', placeholder: 'z.B. Spaziergang', oninput: (e) => { day.note = e.target.value; } }))),
      h('section', { class: 'card form-grid' },
        toggle({ label: 'Ausdauer davor', checked: !!day.before, onChange: (v) => { day.before = v ? cardioBlock() : null; draw(); } }),
        day.before ? cardioEditor(day.before, draw) : null),
      h('section', { class: 'card form-grid' },
        toggle({ label: 'Ausdauer danach', checked: !!day.after, onChange: (v) => { day.after = v ? cardioBlock() : null; draw(); } }),
        day.after ? cardioEditor(day.after, draw) : null),
      h('button', { class: 'btn primary block', onclick: save }, 'Speichern'));
  }

  async function save() {
    for (const b of [day.before, day.after].filter(Boolean)) {
      if (!b.min || b.min <= 0) return toast('Bitte die Dauer der Ausdauer eintragen.');
      if (b.max == null || b.max < b.min) b.max = b.min;
    }
    phase.weekplan[wd] = day;
    if (await store.savePhase(phase)) {
      toast('Gespeichert');
      ctx.back(`/plan?phase=${phase.id}`);
    }
  }

  draw();
}

// ---------------------------------------------------------------- Einheit bearbeiten

export function renderUnit(ctx) {
  const u = store.unit(ctx.params[0]);
  if (!u) return ctx.replace('/plan');
  ctx.top({ title: u.name || 'Einheit', back: true });

  const usage = store.unitUsage(u.id);
  ctx.main.append(h('section', { class: 'card form-grid' },
    field('Name', h('input', { type: 'text', value: u.name, onchange: (e) => {
      u.name = e.target.value.trim() || 'Einheit';
      store.saveUnit(u);
      ctx.top({ title: u.name, back: true });
    } })),
    field('Hinweis beim Start', h('textarea', { rows: 2, value: u.hint ?? '', onchange: (e) => { u.hint = e.target.value; store.saveUnit(u); } })),
    h('p', { class: 'muted small' }, usage.length
      ? `Geplant: ${usage.map((x) => `${x.phase.name} ${WEEKDAY_NAMES[x.weekday].slice(0, 2)}`).join(', ')}`
      : 'In keinem Wochenplan eingeplant.')));

  const list = h('div', { class: 'list' });
  u.exerciseIds.forEach((id, i) => {
    const ex = store.exercise(id);
    if (!ex) return;
    const move = async (dir) => {
      const j = i + dir;
      [u.exerciseIds[i], u.exerciseIds[j]] = [u.exerciseIds[j], u.exerciseIds[i]];
      await store.saveUnit(u);
      ctx.refresh();
    };
    list.append(h('div', { class: 'list-row edit-row' },
      h('div', { class: 'order-btns' },
        h('button', { class: 'icon-btn', 'aria-label': `${ex.name} nach oben`, disabled: i === 0, onclick: () => move(-1) }, icon('up')),
        h('button', { class: 'icon-btn', 'aria-label': `${ex.name} nach unten`, disabled: i === u.exerciseIds.length - 1, onclick: () => move(1) }, icon('down'))),
      h('a', { class: 'list-main', href: `#/plan/uebung/${ex.id}` },
        h('span', { class: 'list-title' }, ex.name),
        h('span', { class: 'list-meta' }, formatTarget(ex), ex.paused ? h('span', { class: 'badge bad' }, 'pausiert') : null)),
      h('button', { class: 'icon-btn', 'aria-label': `${ex.name} aus der Einheit entfernen`, onclick: async () => {
        if (!await confirmDialog(`"${ex.name}" aus dieser Einheit entfernen? Die Übung bleibt in der Bibliothek.`, { ok: 'Entfernen', danger: true })) return;
        u.exerciseIds = u.exerciseIds.filter((x) => x !== id);
        await store.saveUnit(u);
        ctx.refresh();
      } }, icon('trash'))));
  });
  ctx.main.append(h('h2', { class: 'list-head' }, `Übungen (${u.exerciseIds.length})`),
    u.exerciseIds.length ? list : h('p', { class: 'muted' }, 'Noch keine Übungen.'));

  ctx.main.append(h('div', { class: 'stack' },
    h('button', { class: 'btn primary block', onclick: async () => {
      const id = await pickExercise({ title: 'Übung hinzufügen', exclude: u.exerciseIds });
      if (!id) return;
      if (id === 'new') return ctx.go(`/plan/uebung/neu?unit=${u.id}`);
      u.exerciseIds.push(id);
      await store.saveUnit(u);
      ctx.refresh();
    } }, icon('plus'), 'Übung hinzufügen'),
    h('button', { class: 'btn danger-text block', onclick: async () => {
      const where = usage.length ? ` Sie wird aus ${usage.length} Wochentag(en) ausgetragen.` : '';
      if (!await confirmDialog(`Einheit "${u.name}" löschen?${where} Die Übungen bleiben in der Bibliothek.`, { title: 'Einheit löschen', ok: 'Löschen', danger: true })) return;
      if (await store.deleteUnit(u.id)) ctx.go('/plan');
    } }, icon('trash'), 'Einheit löschen')));
}

// ---------------------------------------------------------------- Bibliothek

export function renderLibrary(ctx) {
  ctx.top({ title: 'Alle Übungen', back: '#/plan' });
  const search = h('input', { type: 'search', class: 'search', placeholder: 'Suchen', 'aria-label': 'Übung suchen', value: ctx.query.get('q') ?? '' });
  const out = h('div');
  ctx.main.append(
    h('a', { class: 'btn primary block', href: '#/plan/uebung/neu' }, icon('plus'), 'Neue Übung'),
    search, out);

  function draw() {
    const q = search.value.trim().toLowerCase();
    const all = store.allExercises().filter((e) => !q || e.name.toLowerCase().includes(q));
    out.replaceChildren();
    for (const [cat, label] of Object.entries(CATEGORIES)) {
      const items = all.filter((e) => e.category === cat);
      if (!items.length) continue;
      out.append(h('h2', { class: 'list-head' }, label), h('div', { class: 'list' }, items.map((e) => {
        const used = store.unitsUsing(e.id).length;
        const meta = [formatTarget(e), used ? `in ${used} Einheit${used > 1 ? 'en' : ''}` : 'nur Ersatz oder ungenutzt'].join(' · ');
        return h('a', { class: 'list-row', href: `#/plan/uebung/${e.id}` },
          h('span', { class: 'list-main' },
            h('span', { class: 'list-title' }, e.name),
            h('span', { class: 'list-meta' }, meta, e.paused ? h('span', { class: 'badge bad' }, 'pausiert') : null)),
          icon('next', 'chev'));
      })));
    }
    if (!all.length) out.append(h('p', { class: 'muted' }, 'Keine passende Übung.'));
  }
  search.addEventListener('input', draw);
  draw();
}

// ---------------------------------------------------------------- Übung bearbeiten

export function renderExercise(ctx) {
  const id = ctx.params[0];
  const unitId = ctx.query.get('unit');
  const isNew = id === 'neu';
  const original = isNew ? null : store.exercise(id);
  if (!isNew && !original) return ctx.replace('/plan/uebungen');
  const ex = isNew ? store.newExercise() : structuredClone(original);

  ctx.top({ title: isNew ? 'Neue Übung' : 'Übung bearbeiten', back: true });
  const form = h('div', { class: 'stack' });
  ctx.main.append(form);

  function draw() {
    const isHold = ex.mode === 'hold';
    fill(form,
      ex.paused ? h('div', { class: 'box bad' },
        h('strong', null, 'Pausiert'),
        h('p', null, `Seit ${ex.pausedSince ? fmtDateShort(ex.pausedSince) : 'unbekannt'} wegen Knie-Ampel Rot. Erst nach ärztlicher Abklärung freigeben.`),
        h('button', { class: 'btn secondary', onclick: async () => {
          if (!await confirmDialog('Ist das ärztlich abgeklärt?', { title: 'Übung freigeben', ok: 'Freigeben' })) return;
          ex.paused = false;
          ex.pausedSince = null;
          if (!isNew) await store.releaseExercise(ex.id);
          draw();
        } }, 'Freigeben')) : null,

      h('section', { class: 'card form-grid' },
        field('Name', h('input', { type: 'text', value: ex.name, oninput: (e) => { ex.name = e.target.value; } })),
        field('Kategorie', select({
          label: 'Kategorie',
          value: ex.category,
          options: Object.entries(CATEGORIES).map(([value, label]) => ({ value, label })),
          onChange: (v) => {
            ex.category = v;
            if (isNew) ex.kneeCheck = v === 'beine' || v === 'stabilitaet';
            draw();
          },
        })),
        h('div', { class: 'field' },
          h('span', { class: 'field-label' }, 'Art'),
          h('div', { class: 'seg' },
            h('button', { type: 'button', class: 'chip', 'aria-pressed': String(!isHold), onclick: () => { if (isHold) { ex.mode = 'reps'; ex.min = 10; ex.max = 12; draw(); } } }, 'Wiederholungen'),
            h('button', { type: 'button', class: 'chip', 'aria-pressed': String(isHold), onclick: () => { if (!isHold) { ex.mode = 'hold'; ex.min = 30; ex.max = 30; ex.weighted = false; draw(); } } }, 'Haltezeit'))),
        h('div', { class: 'form-row three' },
          field('Sätze', numberInput({ label: 'Sätze', decimal: false, value: formatNum(ex.sets), onInput: (v) => { ex.sets = parseNum(v); } })),
          field(isHold ? 'Sekunden von' : 'Wdh. von', numberInput({ label: isHold ? 'Sekunden von' : 'Wiederholungen von', decimal: false, value: formatNum(ex.min), onInput: (v) => { ex.min = parseNum(v); } })),
          field('bis', numberInput({ label: isHold ? 'Sekunden bis' : 'Wiederholungen bis', decimal: false, value: formatNum(ex.max), onInput: (v) => { ex.max = parseNum(v); } }))),
        field('Pause nach jedem Satz (s)', numberInput({ label: 'Pause in Sekunden', decimal: false, value: formatNum(ex.restSec), onInput: (v) => { ex.restSec = parseNum(v) ?? 0; } }), '0 = kein Pausentimer'),
        toggle({ label: 'Je Seite', checked: ex.perSide, onChange: (v) => { ex.perSide = v; } }),
        toggle({ label: 'Mit Gewicht', checked: ex.weighted, onChange: (v) => { ex.weighted = v; if (!v) ex.assisted = false; draw(); } }),
        ex.weighted ? toggle({ label: 'Gewicht ist Unterstützung (weniger ist schwerer)', checked: ex.assisted, onChange: (v) => { ex.assisted = v; } }) : null,
        toggle({ label: 'Knie-Ampel nach der Übung', checked: ex.kneeCheck, onChange: (v) => { ex.kneeCheck = v; } }),
        field('Hinweis im Training', h('textarea', { rows: 3, value: ex.hint ?? '', oninput: (e) => { ex.hint = e.target.value; } }))),

      alternativesCard(ex, draw),

      h('div', { class: 'stack' },
        h('button', { class: 'btn primary block', onclick: save }, 'Speichern'),
        !isNew ? h('a', { class: 'btn secondary block', href: `#/verlauf/uebung/${ex.id}` }, 'Verlauf ansehen') : null,
        !isNew ? h('button', { class: 'btn danger-text block', onclick: remove }, icon('trash'), 'Übung löschen') : null));
  }

  async function save() {
    ex.name = ex.name.trim();
    if (!ex.name) return toast('Bitte einen Namen eintragen.');
    if (!Number.isInteger(ex.sets) || ex.sets < 1 || ex.sets > 20) return toast('Sätze: bitte eine ganze Zahl von 1 bis 20.');
    if (!ex.min || ex.min < 1) return toast(`Bitte ${ex.mode === 'hold' ? 'die Haltezeit' : 'die Wiederholungen'} eintragen.`);
    if (ex.max == null || ex.max < ex.min) ex.max = ex.min;
    if (!await store.saveExercise(ex)) return;
    if (isNew && unitId) {
      const u = store.unit(unitId);
      if (u) {
        u.exerciseIds.push(ex.id);
        await store.saveUnit(u);
      }
    }
    toast('Gespeichert');
    if (isNew && unitId) ctx.replace(`/plan/einheit/${unitId}`);
    else ctx.back('/plan/uebungen');
  }

  async function remove() {
    const units = store.unitsUsing(ex.id);
    const where = units.length ? ` Sie wird aus ${units.map((u) => `"${u.name}"`).join(', ')} entfernt.` : '';
    if (!await confirmDialog(`"${ex.name}" löschen?${where} Der Verlauf bleibt erhalten.`, { title: 'Übung löschen', ok: 'Löschen', danger: true })) return;
    if (await store.deleteExercise(ex.id)) ctx.back('/plan/uebungen');
  }

  draw();
}

function alternativesCard(ex, redraw) {
  const rows = ex.alternatives.map((id) => store.exercise(id)).filter(Boolean).map((alt) =>
    h('div', { class: 'list-row' },
      h('span', { class: 'list-main' }, h('span', { class: 'list-title' }, alt.name), h('span', { class: 'list-meta' }, formatTarget(alt))),
      h('button', { class: 'icon-btn', 'aria-label': `${alt.name} als Ersatz entfernen`, onclick: () => {
        ex.alternatives = ex.alternatives.filter((x) => x !== alt.id);
        redraw();
      } }, icon('close'))));
  return h('section', { class: 'card' },
    h('h2', null, 'Ersatzübungen'),
    h('p', { class: 'muted small' }, 'Stehen beim Tauschen im Training ganz oben.'),
    rows.length ? h('div', { class: 'list flat' }, rows) : null,
    h('button', { class: 'btn secondary block', onclick: async () => {
      const id = await pickExercise({ title: 'Ersatz hinzufügen', exclude: [ex.id, ...ex.alternatives], allowNew: false });
      if (!id) return;
      ex.alternatives = [...ex.alternatives, id];
      redraw();
    } }, icon('plus'), 'Ersatz hinzufügen'));
}
