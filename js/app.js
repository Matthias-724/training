// Einstieg: Daten laden, Routen auflösen, Rahmen (Kopfzeile, Navigation) verwalten.

import * as store from './store.js';
import { h, icon, clear, toast } from './ui/dom.js';
import { unlockAudio, keepScreenOn } from './ui/device.js';
import { infoSheet, morningCheck } from './ui/sheets.js';
import { dateKey, pendingMorningCheck } from './logic.js';
import * as heute from './views/heute.js';
import * as training from './views/training.js';
import * as ausdauer from './views/ausdauer.js';
import * as verlauf from './views/verlauf.js';
import * as plan from './views/plan.js';
import * as mehr from './views/mehr.js';

const ROUTES = [
  { re: /^\/heute$/, view: heute.render, tab: 'heute' },
  { re: /^\/training$/, view: training.render, tab: null, training: true },
  { re: /^\/ausdauer(?:\/([\w-]+))?$/, view: ausdauer.render, tab: 'heute' },
  { re: /^\/verlauf(?:\/(trainings|uebungen|knie))?$/, view: verlauf.renderList, tab: 'verlauf' },
  { re: /^\/verlauf\/training\/([\w-]+)$/, view: verlauf.renderTraining, tab: 'verlauf' },
  { re: /^\/verlauf\/uebung\/([\w-]+)$/, view: verlauf.renderExercise, tab: 'verlauf' },
  { re: /^\/plan$/, view: plan.renderOverview, tab: 'plan' },
  { re: /^\/plan\/tag\/([\w-]+)\/(\w+)$/, view: plan.renderDay, tab: 'plan' },
  { re: /^\/plan\/einheit\/([\w-]+)$/, view: plan.renderUnit, tab: 'plan' },
  { re: /^\/plan\/uebungen$/, view: plan.renderLibrary, tab: 'plan' },
  { re: /^\/plan\/uebung\/([\w-]+)$/, view: plan.renderExercise, tab: 'plan' },
  { re: /^\/mehr$/, view: mehr.render, tab: 'mehr' },
];

const TABS = [
  ['heute', 'Heute', 'today'],
  ['verlauf', 'Verlauf', 'history'],
  ['plan', 'Plan', 'plan'],
  ['mehr', 'Mehr', 'more'],
];

const el = {};
let current = null;
// Eigene Liste der besuchten Seiten, damit "Zurück" weiß, ob es ein Zurück in der App gibt.
const visited = [];

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/heute';
  const [path, qs] = raw.split('?');
  return { path, query: new URLSearchParams(qs ?? '') };
}

// ---------------------------------------------------------------- Rahmen

function buildShell() {
  el.left = h('div', { class: 'top-left' });
  el.title = h('h1', { class: 'top-title' });
  el.topbar = h('header', { class: 'topbar' },
    el.left, el.title,
    h('button', { class: 'icon-btn top-info', 'aria-label': 'Info, Tabu-Liste und Knie-Ampel', onclick: infoSheet }, icon('info')));
  el.main = h('main', { id: 'view', tabindex: '-1' });
  el.nav = h('nav', { class: 'tabbar', 'aria-label': 'Hauptnavigation' },
    TABS.map(([id, label, ic]) => h('a', { href: `#/${id}`, dataset: { tab: id } }, icon(ic), h('span', null, label))));
  const app = document.getElementById('app');
  clear(app).append(el.topbar, el.main, el.nav);
}

function setTop({ title = '', back = null, left = null }) {
  el.title.textContent = title;
  document.title = title ? `${title} · Training` : 'Training';
  clear(el.left);
  if (left) el.left.append(left);
  else if (back) {
    el.left.append(h('button', { class: 'icon-btn', 'aria-label': 'Zurück', onclick: () => goBack(back) }, icon('back')));
  }
}

/** back === true: eine Seite zurück. Sonst ein festes Ziel, aber über die Browser-Historie, wenn es die vorige Seite ist. */
function goBack(back) {
  if (back === true) return ctxBack('/heute');
  const target = back.startsWith('#') ? back : `#${back}`;
  if (visited.at(-2) === target) history.back();
  else navigate(target.slice(1));
}

// ---------------------------------------------------------------- Navigation

function navigate(path) {
  if (`#${path}` === location.hash) render({ scrollTop: true });
  else location.hash = `#${path}`;
}

function replace(path) {
  history.replaceState(null, '', `#${path}`);
  visited[Math.max(0, visited.length - 1)] = `#${path}`;
  render({ scrollTop: true });
}

function ctxBack(fallback) {
  if (visited.length > 1) history.back();
  else replace(fallback);
}

function onHashChange() {
  const hash = location.hash;
  if (visited.at(-2) === hash) visited.pop();
  else visited.push(hash);
  render({ scrollTop: true });
}

function render({ scrollTop = false } = {}) {
  const { path, query } = parseHash();
  let match = null;
  const route = ROUTES.find((r) => (match = r.re.exec(path)));
  if (!route) return replace('/heute');

  const keepScroll = !scrollTop && current?.path === path ? window.scrollY : 0;
  current = { path, route };
  document.body.classList.toggle('training', !!route.training);
  if (!route.training) keepScreenOn(false);
  for (const a of el.nav.querySelectorAll('a')) {
    if (a.dataset.tab === route.tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }

  clear(el.main);
  const ctx = {
    main: el.main,
    params: match.slice(1).filter((x) => x !== undefined),
    query,
    top: setTop,
    go: navigate,
    replace,
    back: ctxBack,
    refresh: (opts) => render(opts),
  };
  try {
    route.view(ctx);
  } catch (err) {
    console.error(err);
    el.main.append(h('div', { class: 'box bad' }, h('strong', null, 'Fehler in dieser Ansicht. '), err.message));
  }
  window.scrollTo(0, keepScroll);
}

// ---------------------------------------------------------------- Kniecheck am Morgen

async function askMorningCheck() {
  if (current?.route.training) return;
  const today = dateKey();
  const ref = pendingMorningCheck(store.trainings(), store.kneeChecks(), today);
  // Nur einmal pro Tag von selbst fragen. Danach bleibt der Hinweis auf "Heute".
  if (!ref || store.meta('morningAskedOn') === today) return;
  await store.setMeta('morningAskedOn', today);
  if (await morningCheck(ref)) render();
}

// ---------------------------------------------------------------- Service Worker

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const offer = (worker) => toast('Neue Version verfügbar', {
      action: 'Aktualisieren',
      duration: 0,
      onAction: () => worker.postMessage('skipWaiting'),
    });
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker);
      });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) reg.update().catch(() => {});
    });
  }).catch((err) => console.warn('Service Worker nicht registriert:', err));
}

// ---------------------------------------------------------------- Start

async function start() {
  store.setErrorHandler((err) => toast(`Speichern fehlgeschlagen: ${err.message}`, { duration: 8000 }));
  try {
    await store.init();
  } catch (err) {
    console.error(err);
    document.getElementById('app').replaceChildren(h('div', { class: 'fatal' },
      h('h1', null, 'Die Daten konnten nicht geladen werden'),
      h('p', null, err.message),
      h('p', null, 'Im privaten Modus von Safari steht kein Speicher zur Verfügung. Bitte die App normal öffnen.')));
    return;
  }

  buildShell();
  if (!location.hash) history.replaceState(null, '', '#/heute');
  visited.push(location.hash);
  window.addEventListener('hashchange', onHashChange);
  render();

  // Ton freischalten, sobald der Nutzer das erste Mal tippt.
  document.addEventListener('touchend', unlockAudio, { passive: true });
  document.addEventListener('click', unlockAudio);

  registerServiceWorker();
  store.requestPersistence();
  askMorningCheck();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      askMorningCheck();
      // Über Mitternacht offen gelassen: Heute-Ansicht zeigt sonst den alten Tag.
      if (current?.route.tab === 'heute' && !document.querySelector('.sheet')) render();
    }
  });
}

start();
