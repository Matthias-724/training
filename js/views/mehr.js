// Mehr: Phase, Klausurmodus, Arzt-Freigaben, Backup, Tabu-Liste, Gerät, Daten.

import { h, icon, toggle, field, openSheet, confirmDialog, choose, toast } from '../ui/dom.js';
import { dateKey, backupStatus } from '../logic.js';
import { fmtDate, fmtDateShort, fmtDaysAgo } from '../format.js';
import * as store from '../store.js';
import { exportBackup, importBackup } from '../backup.js';
import { phaseHintSheet } from '../ui/sheets.js';
import { isStandalone, wakeLockSupported } from '../ui/device.js';
import { APP_VERSION } from '../version.js';

export function render(ctx) {
  ctx.top({ title: 'Mehr' });
  ctx.main.append(
    phaseSection(ctx),
    h('section', { class: 'card' },
      toggle({
        label: 'Klausurmodus',
        checked: store.meta('examMode', false),
        onChange: async (v) => {
          await store.setMeta('examMode', v);
          toast(v ? 'Klausurmodus an: nur Montag, Dienstag und Freitag' : 'Klausurmodus aus');
        },
      }),
      h('p', { class: 'muted small' }, 'Reduziert den Wochenplan auf Montag, Dienstag und Freitag. Der Plan selbst bleibt unverändert.')),
    clearanceSection(ctx),
    backupSection(ctx),
    tabuSection(),
    deviceSection(),
    dataSection(ctx),
    h('p', { class: 'muted small center' }, `Version ${APP_VERSION}`));
}

// ---------------------------------------------------------------- Phase

function phaseSection(ctx) {
  const active = store.activePhase();
  const rows = store.allPhases().map((p) => {
    const isActive = p.id === active.id;
    return h('div', { class: `phase-row ${isActive ? 'active' : ''} ${p.locked ? 'locked' : ''}` },
      h('div', { class: 'list-main' },
        h('span', { class: 'list-title' }, p.name, isActive ? h('span', { class: 'badge good' }, 'aktiv') : null),
        h('span', { class: 'list-meta' }, p.title)),
      p.locked
        ? h('button', { class: 'btn small secondary', onclick: () => unlock(ctx, p) }, icon('lock'), 'Freischalten')
        : isActive
          ? h('button', { class: 'btn small secondary', onclick: () => phaseHintSheet(p) }, 'Hinweis')
          : h('button', { class: 'btn small primary', onclick: () => activate(ctx, p) }, 'Wechseln'));
  });
  return h('section', { class: 'card' }, h('h2', null, 'Phase'), h('div', { class: 'phase-list' }, rows));
}

async function activate(ctx, p) {
  await store.setMeta('activePhaseId', p.id);
  ctx.refresh();
  await phaseHintSheet(p);
}

async function unlock(ctx, p) {
  const v = await choose(`${p.name} freischalten`, [
    { label: 'Freischalten und Freigabe eintragen', value: 'note', kind: 'primary' },
    { label: 'Nur freischalten', value: 'plain' },
  ], `Nur nach Freigabe vom Arzt: ${p.title}.`);
  if (!v) return;
  p.locked = false;
  await store.savePhase(p);
  ctx.refresh();
  if (v === 'note') await editClearance(ctx, null, `${p.name} freigegeben: `);
  if (await confirmDialog(`Jetzt zu ${p.name} wechseln?`, { title: 'Phase wechseln', ok: 'Wechseln', cancel: 'Später' })) {
    await activate(ctx, p);
  }
}

// ---------------------------------------------------------------- Freigaben vom Arzt

function clearanceSection(ctx) {
  const list = store.clearances();
  return h('section', { class: 'card' },
    h('div', { class: 'section-head' },
      h('h2', null, 'Freigaben vom Arzt'),
      h('button', { class: 'btn small secondary', onclick: () => editClearance(ctx) }, icon('plus'), 'Neu')),
    list.length
      ? h('div', { class: 'list flat' }, list.map((c) => h('button', { class: 'list-row', onclick: () => editClearance(ctx, c) },
        h('span', { class: 'list-date' }, fmtDateShort(c.date)),
        h('span', { class: 'list-main' }, h('span', { class: 'list-meta pre' }, c.text)),
        icon('edit', 'chev'))))
      : h('p', { class: 'muted small' }, 'Was erlaubt ist, mit Datum festhalten. Zum Beispiel Belastung, Bewegungsumfang, Rad ohne Widerstand.'));
}

function editClearance(ctx, existing = null, prefill = '') {
  return new Promise((resolve) => {
    const c = existing ? { ...existing } : { id: store.uid('fr'), date: dateKey(), text: prefill };
    const text = h('textarea', { rows: 4, value: c.text, oninput: (e) => { c.text = e.target.value; } });
    const actions = [
      existing ? { label: 'Löschen', kind: 'danger-text', onClick: async (close) => {
        close();
        if (await confirmDialog('Diese Freigabe löschen?', { ok: 'Löschen', danger: true })) {
          await store.deleteClearance(c.id);
          ctx.refresh();
        }
      } } : null,
      { label: 'Speichern', kind: 'primary', onClick: async (close) => {
        if (!c.text.trim()) return toast('Bitte eintragen, was freigegeben ist.');
        if (await store.saveClearance(c)) {
          close('saved');
          ctx.refresh();
        }
      } },
    ].filter(Boolean);
    openSheet({
      title: existing ? 'Freigabe bearbeiten' : 'Neue Freigabe',
      body: h('div', { class: 'form-grid' },
        field('Datum', h('input', { type: 'date', value: c.date, onchange: (e) => { if (e.target.value) c.date = e.target.value; } })),
        field('Was ist erlaubt?', text)),
      actions,
      onClose: () => resolve(),
    });
    // Der Cursor steht am Ende des vorbelegten Textes.
    setTimeout(() => { text.focus(); text.setSelectionRange(text.value.length, text.value.length); }, 200);
  });
}

// ---------------------------------------------------------------- Backup

function backupSection(ctx) {
  const last = store.meta('lastBackupAt');
  const status = backupStatus(last, store.meta('installedAt'), Date.now());
  return h('section', { class: 'card' },
    h('h2', null, 'Backup'),
    h('p', { class: status.due ? 'warn-text' : 'muted small' },
      last ? `Letztes Backup: ${fmtDate(dateKey(new Date(last)))} (${fmtDaysAgo(status.days)})` : 'Noch kein Backup gemacht.'),
    h('p', { class: 'muted small' }, 'iOS kann Website-Daten löschen, wenn der Speicher knapp wird. Das Backup als Datei in iCloud oder auf dem Rechner sichern. Die App erinnert, wenn es älter als 14 Tage ist.'),
    h('div', { class: 'stack' },
      h('button', { class: 'btn primary block', onclick: async () => { if (await exportBackup()) ctx.refresh(); } }, icon('download'), 'Backup erstellen'),
      h('button', { class: 'btn secondary block', onclick: async () => { if (await importBackup()) ctx.refresh(); } }, icon('upload'), 'Backup einspielen')));
}

// ---------------------------------------------------------------- Tabu-Liste

function tabuSection() {
  const area = h('textarea', { rows: 8, value: store.tabu().join('\n') });
  area.addEventListener('change', async () => {
    const items = area.value.split('\n').map((x) => x.trim()).filter(Boolean);
    if (await store.setMeta('tabu', items)) toast('Tabu-Liste gespeichert');
  });
  return h('section', { class: 'card' },
    h('h2', null, 'Tabu-Liste'),
    h('p', { class: 'muted small' }, 'Eine Zeile pro Punkt. Erscheint im Info-Knopf oben rechts.'),
    area);
}

// ---------------------------------------------------------------- Gerät

function deviceSection() {
  const persisted = h('span', null, 'wird geprüft');
  navigator.storage?.persisted?.().then((p) => { persisted.textContent = p ? 'ja' : 'nein, Backup umso wichtiger'; })
    .catch(() => { persisted.textContent = 'unbekannt'; });
  if (!navigator.storage?.persisted) persisted.textContent = 'unbekannt';
  return h('section', { class: 'card' },
    h('h2', null, 'Gerät'),
    h('dl', { class: 'facts' },
      h('dt', null, 'Als App installiert'), h('dd', null, isStandalone() ? 'ja' : 'nein, läuft im Browser'),
      h('dt', null, 'Bildschirm bleibt an'), h('dd', null, wakeLockSupported() ? 'ja, während des Trainings' : 'nicht unterstützt'),
      h('dt', null, 'Daten dauerhaft gespeichert'), h('dd', null, persisted)),
    isStandalone() ? null : h('p', { class: 'muted small' }, 'Installation auf dem iPhone: in Safari auf Teilen tippen, dann "Zum Home-Bildschirm". Danach die App nur noch über das Symbol öffnen.'));
}

// ---------------------------------------------------------------- Daten

function dataSection(ctx) {
  return h('section', { class: 'card' },
    h('h2', null, 'Daten'),
    h('div', { class: 'stack' },
      h('button', { class: 'btn secondary block', onclick: async () => {
        const ok = await confirmDialog('Alle Übungen, Einheiten und Wochenpläne werden auf den Startplan zurückgesetzt. Eigene Übungen, Änderungen und Pausierungen gehen verloren. Der Verlauf bleibt.', { title: 'Plan zurücksetzen', ok: 'Zurücksetzen', danger: true });
        if (!ok) return;
        await store.resetPlan();
        toast('Plan zurückgesetzt');
        ctx.refresh();
      } }, 'Plan auf Startdaten zurücksetzen'),
      h('button', { class: 'btn danger-text block', onclick: async () => {
        const ok = await confirmDialog('Alle Trainings, Messwerte, Freigaben und Planänderungen werden gelöscht. Das lässt sich nur mit einem Backup rückgängig machen.', { title: 'Alle Daten löschen', ok: 'Alles löschen', danger: true });
        if (!ok) return;
        await store.wipeAll();
        toast('Alle Daten gelöscht');
        ctx.go('/heute');
      } }, icon('trash'), 'Alle Daten löschen')));
}
