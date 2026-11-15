// Kleine DOM-Helfer, Dialoge und Hinweise. Keine Fachlogik.

const PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'hidden', 'indeterminate']);

/**
 * h('button', { class: 'btn', onclick: fn }, 'Text', kind, ...)
 * Texte werden immer als Textknoten eingesetzt, nie als HTML. Übungsnamen und
 * Notizen kommen vom Nutzer oder aus importierten Dateien.
 */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  setAttrs(el, attrs);
  append(el, children);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function s(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

function setAttrs(el, attrs) {
  if (!attrs) return;
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (PROPS.has(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/**
 * Ersetzt den Inhalt. Anders als replaceChildren überspringt es null und false,
 * statt den Text "null" einzufügen.
 */
export function fill(el, ...children) {
  return append(clear(el), children);
}

// ---------------------------------------------------------------- Icons
//
// Eigene Strichzeichnungen im 24er-Raster. Keine Emojis, keine Icon-Bibliothek.

const ICONS = {
  today: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="12" cy="15.5" r="1.6" fill="currentColor"/>',
  history: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  plan: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="3"/>',
  more: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-5M12 8h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  swap: '<path d="M17 3l4 4-4 4M3 7h18M7 21l-4-4 4-4M21 17H3"/>',
  play: '<path d="M7 4v16l13-8z" fill="currentColor" stroke="none"/>',
  skip: '<path d="M5 4l10 8-10 8zM19 5v14"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  bike: '<circle cx="6" cy="17" r="3.5"/><circle cx="18" cy="17" r="3.5"/><path d="M6 17l4-8h5l3 8M10 9 8 5H6M15 9l-3 8"/>',
};

export function icon(name, cls = '') {
  const el = document.createElementNS(SVG_NS, 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('class', `icon ${cls}`.trim());
  el.innerHTML = ICONS[name] ?? '';
  return el;
}

// ---------------------------------------------------------------- Bottom Sheet

let sheetStack = [];

/**
 * Öffnet ein Blatt von unten. Gibt { close, el, body } zurück.
 * onClose wird genau einmal aufgerufen, egal wie das Blatt geschlossen wird.
 */
export function openSheet({ title, body, actions = [], onClose, dismissible = true, cls = '' }) {
  const previousFocus = document.activeElement;
  let closed = false;
  const backdrop = h('div', { class: 'sheet-backdrop' });
  const content = h('div', { class: 'sheet-body' }, body);
  const footer = actions.length ? h('div', { class: 'sheet-actions' }) : null;
  const titleId = `sheet-${Math.random().toString(36).slice(2)}`;
  const panel = h('div', { class: `sheet ${cls}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' },
    h('div', { class: 'sheet-head' },
      h('h2', { id: titleId }, title),
      dismissible ? h('button', { class: 'icon-btn', 'aria-label': 'Schließen', onclick: () => close() }, icon('close')) : null),
    content,
    footer);

  const close = (result) => {
    if (closed) return;
    closed = true;
    sheetStack = sheetStack.filter((x) => x !== close);
    backdrop.classList.add('leaving');
    panel.classList.add('leaving');
    setTimeout(() => { backdrop.remove(); panel.remove(); }, 180);
    if (!sheetStack.length) document.body.classList.remove('sheet-open');
    document.removeEventListener('keydown', onKey);
    if (previousFocus?.focus) previousFocus.focus({ preventScroll: true });
    onClose?.(result);
  };

  const onKey = (e) => {
    if (e.key === 'Escape' && dismissible && sheetStack.at(-1) === close) close();
  };

  for (const a of actions) {
    footer.append(h('button', {
      class: `btn ${a.kind ?? 'secondary'}`,
      onclick: () => (a.onClick ? a.onClick(close) : close(a.value)),
    }, a.label));
  }

  if (dismissible) backdrop.addEventListener('click', () => close());
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop, panel);
  document.body.classList.add('sheet-open');
  sheetStack.push(close);
  requestAnimationFrame(() => panel.focus({ preventScroll: true }));
  return { close, el: panel, body: content };
}

/** Ja/Nein-Abfrage. Liefert true bei Bestätigung. */
export function confirmDialog(message, { title = 'Bitte bestätigen', ok = 'OK', cancel = 'Abbrechen', danger = false } = {}) {
  return new Promise((resolve) => {
    openSheet({
      title,
      body: h('p', { class: 'sheet-text' }, message),
      actions: [
        { label: cancel, kind: 'secondary', value: false },
        { label: ok, kind: danger ? 'danger' : 'primary', value: true },
      ],
      onClose: (v) => resolve(v === true),
    });
  });
}

/** Auswahl aus mehreren Möglichkeiten. Liefert den Wert oder null. */
export function choose(title, options, message = '') {
  return new Promise((resolve) => {
    const list = h('div', { class: 'choice-list' });
    const sheet = openSheet({
      title,
      body: [message ? h('p', { class: 'sheet-text' }, message) : null, list],
      onClose: (v) => resolve(v ?? null),
    });
    for (const o of options) {
      list.append(h('button', { class: `btn block ${o.kind ?? 'secondary'}`, onclick: () => sheet.close(o.value) },
        h('span', { class: 'choice-label' }, o.label),
        o.detail ? h('span', { class: 'choice-detail' }, o.detail) : null));
    }
  });
}

// ---------------------------------------------------------------- Toast

let toastTimer = null;

export function toast(message, { action, onAction, duration = 3500 } = {}) {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  clear(el);
  el.append(h('span', null, message));
  if (action) {
    el.append(h('button', { class: 'toast-action', onclick: () => { hide(); onAction?.(); } }, action));
  }
  el.classList.add('visible');
  clearTimeout(toastTimer);
  const hide = () => el.classList.remove('visible');
  if (duration) toastTimer = setTimeout(hide, duration);
}

// ---------------------------------------------------------------- Formularfelder

/** Beschriftetes Feld. Das Label umschließt das Eingabeelement für große Tippflächen. */
export function field(label, input, hint = '') {
  return h('label', { class: 'field' },
    h('span', { class: 'field-label' }, label),
    input,
    hint ? h('span', { class: 'field-hint' }, hint) : null);
}

/**
 * Zahlenfeld mit Komma-Unterstützung. type="text" statt "number", weil
 * iOS bei type="number" in deutscher Sprache kein Komma annimmt.
 */
export function numberInput({ value, onInput, placeholder = '', decimal = true, cls = '', label }) {
  const el = h('input', {
    class: `num ${cls}`.trim(),
    type: 'text',
    inputmode: decimal ? 'decimal' : 'numeric',
    autocomplete: 'off',
    enterkeyhint: 'done',
    placeholder,
    value: value ?? '',
    'aria-label': label,
  });
  el.addEventListener('focus', () => setTimeout(() => el.select(), 0));
  el.addEventListener('input', () => onInput?.(el.value));
  return el;
}

export function toggle({ checked, onChange, label }) {
  const input = h('input', { type: 'checkbox', role: 'switch', checked: !!checked, class: 'switch-input' });
  input.addEventListener('change', () => onChange(input.checked));
  return h('label', { class: 'switch' }, h('span', { class: 'switch-label' }, label), input, h('span', { class: 'switch-track', 'aria-hidden': 'true' }));
}

export function select({ value, options, onChange, label }) {
  const el = h('select', { 'aria-label': label });
  for (const o of options) el.append(h('option', { value: o.value, selected: o.value === value }, o.label));
  el.addEventListener('change', () => onChange(el.value));
  return el;
}
