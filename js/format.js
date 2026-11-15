// Deutsche Anzeigeformate für Datum, Uhrzeit und Dauer. Ohne DOM, mit Node testbar.

import { parseDateKey, formatNum } from './logic.js';

const long = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
const shortWd = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });
const month = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
const time = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

/** "Sonntag, 15. November" */
export function fmtDateLong(key) {
  return long.format(parseDateKey(key));
}

/** "So, 15.11." */
export function fmtDateShort(key) {
  const d = parseDateKey(key);
  const wd = shortWd.format(d).replace('.', '');
  return `${wd}, ${d.getDate()}.${d.getMonth() + 1}.`;
}

/** "15.11.2026" */
export function fmtDate(key) {
  const d = parseDateKey(key);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

/** "15.11." */
export function fmtDayMonth(key) {
  const d = parseDateKey(key);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

/** "November 2026" */
export function fmtMonth(key) {
  return month.format(parseDateKey(key));
}

/** "14:05" */
export function fmtTime(timestamp) {
  return time.format(new Date(timestamp));
}

/** "45 min", "1 h 05 min" */
export function fmtDuration(ms) {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

/** "1:30" */
export function fmtClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Erledigte Sätze in einer Zeile: "60 kg × 12 · 12 · 11", "30 s · 30 s",
 * bei wechselndem Gewicht "60 kg × 12 · 65 kg × 10".
 */
export function fmtSets(entry) {
  const done = entry.sets.filter((s) => s.done);
  if (!done.length) return 'nichts erledigt';
  const val = (s) => (entry.mode === 'hold' ? `${formatNum(s.hold)} s` : formatNum(s.reps));
  const prefix = entry.assisted ? 'Hilfe ' : '';
  if (entry.weighted && done.some((s) => s.weight != null)) {
    if (done.every((s) => s.weight === done[0].weight)) {
      return `${prefix}${formatNum(done[0].weight)} kg × ${done.map(val).join(' · ')}`;
    }
    return done.map((s) => `${s.weight != null ? `${prefix}${formatNum(s.weight)} kg × ` : ''}${val(s)}`).join(' · ');
  }
  return done.map(val).join(' · ') + (entry.mode === 'reps' ? ' Wdh.' : '');
}

/** "vor 3 Tagen", "heute", "gestern" */
export function fmtDaysAgo(days) {
  if (days <= 0) return 'heute';
  if (days === 1) return 'gestern';
  return `vor ${days} Tagen`;
}
