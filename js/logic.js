// Fachlogik der App: Knie-Ampel, Steigerungshinweis, Wochenplan, Datumsrechnung.
//
// Regel für dieses Modul: keine DOM-Zugriffe, kein Speicher, keine Seiteneffekte.
// Alles hier bekommt Daten rein und gibt Daten raus, damit es mit Node getestet
// werden kann (tests/logic.test.mjs) und die Regeln an genau einer Stelle stehen.

// ---------------------------------------------------------------- Wochentage

export const WEEKDAYS = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];

export const WEEKDAY_NAMES = {
  mo: 'Montag', di: 'Dienstag', mi: 'Mittwoch', do: 'Donnerstag',
  fr: 'Freitag', sa: 'Samstag', so: 'Sonntag',
};

export const WEEKDAY_SHORT = {
  mo: 'Mo', di: 'Di', mi: 'Mi', do: 'Do', fr: 'Fr', sa: 'Sa', so: 'So',
};

/** Tage, die im Klausurmodus übrig bleiben. */
export const EXAM_DAYS = ['mo', 'di', 'fr'];

// ---------------------------------------------------------------- Datum
//
// Datumswerte werden als lokaler Kalendertag 'JJJJ-MM-TT' gespeichert, nicht als
// UTC-Zeitstempel. Ein Training um 0:30 Uhr soll zum Tag gehören, an dem es auf
// dem iPhone stattfand, und Sommerzeitwechsel dürfen keinen Tag verschieben.

export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, days) {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

/** Ganze Kalendertage von a nach b. Runden fängt 23- und 25-Stunden-Tage ab. */
export function daysBetween(a, b) {
  return Math.round((parseDateKey(b) - parseDateKey(a)) / 86_400_000);
}

export function weekdayOf(key) {
  // getDay(): 0 = Sonntag. Die App denkt in Wochen ab Montag.
  return WEEKDAYS[(parseDateKey(key).getDay() + 6) % 7];
}

export function weekStart(key) {
  return addDays(key, -WEEKDAYS.indexOf(weekdayOf(key)));
}

// ---------------------------------------------------------------- Zahlen

/** Liest "12,5" und "12.5" gleich. Leer oder ungültig ergibt null. */
export function parseNum(text) {
  if (text == null) return null;
  const s = String(text).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function formatNum(n) {
  if (n == null || !Number.isFinite(n)) return '';
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

// ---------------------------------------------------------------- Knie-Ampel

export const COLORS = ['gruen', 'gelb', 'rot'];

export const AMPEL = {
  gruen: { label: 'Grün', rule: 'Weitermachen, langsam steigern' },
  gelb: { label: 'Gelb', rule: 'Gewicht oder Bewegungsumfang zurücknehmen' },
  rot: { label: 'Rot', rule: 'Übung streichen und beim Arzt abklären' },
};

export const KNEE_FLAGS = {
  stechend: 'Stechender Schmerz',
  wegknicken: 'Wegknicken',
  blockieren: 'Blockieren',
  schwellung: 'Deutliche Schwellung',
};

/**
 * Ampelfarbe direkt nach einer Übung.
 * Warnzeichen schlagen jeden Schmerzwert. Über 5 gilt nach dem
 * Schmerz-Monitoring-Modell (Thomeé 1997) als hohes Risiko, deshalb Rot,
 * auch wenn der ursprüngliche Plan diesen Bereich offen ließ.
 */
export function ampelColor(pain, flags = {}) {
  if (Object.values(flags).some(Boolean)) return 'rot';
  if (pain == null) return null;
  if (pain >= 6) return 'rot';
  if (pain >= 4) return 'gelb';
  return 'gruen';
}

/** Die schlechtere von zwei Farben. null zählt als "keine Angabe". */
export function worseColor(a, b) {
  const i = Math.max(COLORS.indexOf(a), COLORS.indexOf(b));
  return i < 0 ? null : COLORS[i];
}

// ---------------------------------------------------------------- Kniecheck am Folgetag

/** Grade des Stroke-Tests (Sturgill 2009). '' heißt: nicht gemessen. */
export const STROKE_GRADES = ['0', 'Spur', '1+', '2+', '3+'];

export const MORNING_TEXT = {
  ok: 'Keine Verschlechterung. Weitermachen wie geplant.',
  halten: 'Leichte Schwellung (1+). Nicht steigern, Belastung halten.',
  gelb: 'Mehr Schwellung oder schlimmer: Gewicht oder Bewegungsumfang zurücknehmen.',
  rot: 'Deutliche Schwellung (3+). Belastung stark reduzieren und beim Arzt abklären.',
};

/**
 * Bewertung des Kniechecks am Morgen nach einem Beintraining.
 * Die Stufen folgen den Delaware-Regeln: 0 oder Spur weiter, 1+ halten,
 * ab 2+ zurücknehmen. "Schlimmer" oder "Schwellung" ohne Messung zählt wie 2+.
 */
export function morningVerdict(check) {
  if (!check) return null;
  const grade = STROKE_GRADES.indexOf(check.stroke ?? '');
  if (grade >= 4) return 'rot';
  if (check.schlimmer || check.schwellung || grade === 3) return 'gelb';
  if (grade === 2) return 'halten';
  return 'ok';
}

/**
 * Farbe einer Übung unter Berücksichtigung des Folgetags.
 * Laut Plan wird Grün zu Gelb, wenn das Knie am nächsten Morgen schlimmer ist.
 * Einen Morgen-Befund kann die App keiner einzelnen Übung zuordnen, deshalb
 * pausiert er nichts automatisch, sondern stuft alle Übungen des Vortags ab.
 */
export function effectiveColor(entry, check) {
  const color = entry?.knee?.color ?? null;
  if (!color) return null;
  const verdict = morningVerdict(check);
  if (verdict === 'gelb' || verdict === 'rot') return worseColor(color, 'gelb');
  return color;
}

/** Datum des Vortags, falls dort ein Beintraining ohne Kniecheck liegt. */
export function pendingMorningCheck(trainings, checks, todayKey) {
  const yesterday = addDays(todayKey, -1);
  if (checks.some((c) => c.refDate === yesterday)) return null;
  const legDay = trainings.some((t) => t.date === yesterday && hasKneeWork(t));
  return legDay ? yesterday : null;
}

export function hasKneeWork(training) {
  return training.entries.some((e) => e.kneeCheck && !e.skipped);
}

// ---------------------------------------------------------------- Satzziele und Steigerung

function setValue(entry, set) {
  return entry.mode === 'hold' ? set.hold : set.reps;
}

/** Alle geplanten Sätze erledigt und jeder mindestens am unteren Zielwert. */
export function entryAchieved(entry) {
  if (!entry || entry.skipped) return false;
  const done = entry.sets.filter((s) => s.done);
  if (done.length < entry.target.sets) return false;
  return done.every((s) => (setValue(entry, s) ?? 0) >= entry.target.min);
}

/** Alle erledigten Sätze am oberen Ende des Zielbereichs. */
export function entryAtTop(entry) {
  const done = entry.sets.filter((s) => s.done);
  return done.length > 0 && done.every((s) => (setValue(entry, s) ?? 0) >= entry.target.max);
}

/**
 * Steigerungshinweis laut Plan: zweimal hintereinander alle Sätze geschafft
 * und die Ampel war grün. Ein Kniecheck mit 1+ oder schlechter sperrt die
 * Steigerung, auch wenn die Farbe selbst grün geblieben ist.
 *
 * @param history Einträge dieser Übung, neueste zuerst: [{ entry, check }]
 */
export function progressionHint(history) {
  const recent = history.filter((h) => !h.entry.skipped).slice(0, 2);
  if (recent.length < 2) return null;
  for (const { entry, check } of recent) {
    if (!entryAchieved(entry)) return null;
    if (entry.kneeCheck) {
      if (effectiveColor(entry, check) !== 'gruen') return null;
      if (morningVerdict(check) === 'halten') return null;
    }
  }
  const latest = recent[0].entry;
  if (latest.mode === 'hold') {
    return { text: 'Steigern: erst Haltezeit, dann Schwierigkeit' };
  }
  if (latest.weighted && entryAtTop(latest)) {
    return latest.assisted
      ? { text: 'Steigern: Wiederholungen sind oben angekommen, jetzt die Unterstützung leicht verringern' }
      : { text: 'Steigern: Wiederholungen sind oben angekommen, jetzt das Gewicht leicht erhöhen' };
  }
  return { text: latest.assisted
    ? 'Steigern, erst Wiederholungen, dann weniger Unterstützung'
    : 'Steigern, erst Wiederholungen, dann Gewicht' };
}

/** Warnung, wenn die letzte Ausführung gelb war. */
export function lastKneeWarning(history) {
  const last = history.find((h) => !h.entry.skipped);
  if (!last || !last.entry.kneeCheck) return null;
  const color = effectiveColor(last.entry, last.check);
  return color === 'gelb' ? { color, text: `Letztes Mal Gelb: ${AMPEL.gelb.rule}` } : null;
}

/**
 * Vorbelegung der Sätze. Wiederholungen kommen aus repsSource, Gewichte aus
 * weightSource. Getrennt, weil Beinübungen nach einer OP nicht mit dem
 * Gewicht von vor der OP vorbelegt werden sollen (siehe store.lastEntries).
 */
export function prefillSets(exercise, repsSource, weightSource) {
  const pick = (entry, i) => entry?.sets?.[i] ?? entry?.sets?.at?.(-1) ?? null;
  const sets = [];
  for (let i = 0; i < exercise.sets; i++) {
    const r = pick(repsSource, i);
    const w = pick(weightSource, i);
    sets.push({
      weight: exercise.weighted ? (w?.weight ?? null) : null,
      reps: exercise.mode === 'reps' ? (r?.reps ?? exercise.min) : null,
      hold: exercise.mode === 'hold' ? (r?.hold ?? exercise.min) : null,
      done: false,
    });
  }
  return sets;
}

/** "3 × 10–12", "4 × 30–45 s", "3 × 10 je Seite" */
export function formatTarget(ex) {
  const range = ex.max != null && ex.max !== ex.min ? `${ex.min}–${ex.max}` : `${ex.min}`;
  const unit = ex.mode === 'hold' ? ' s' : '';
  return `${ex.sets} × ${range}${unit}${ex.perSide ? ' je Seite' : ''}`;
}

// ---------------------------------------------------------------- Ausdauer

export const CARDIO_TYPES = {
  rad_indoor: 'Rad indoor',
  rad_draussen: 'Rad draußen',
  schwimmen: 'Schwimmen',
  ergometer: 'Ergometer',
  armkurbel: 'Armkurbel-Ergometer',
  sonstiges: 'Sonstiges',
};

export const ZONE2_HINT = 'Du kannst noch in ganzen Sätzen reden. Keine Intervalle, kein Wiegetritt, leichte Gänge, Trittfrequenz 85 bis 95.';

/** "15 min Ergometer, locker" oder "45–60 min Rad indoor, Zone 2" */
export function cardioSummary(block) {
  const types = block.types.map((t) => CARDIO_TYPES[t] ?? t).join(' oder ');
  const dur = block.max && block.max !== block.min ? `${block.min}–${block.max} min` : `${block.min} min`;
  return [`${dur} ${types}`, block.zone2 ? 'Zone 2' : '', block.text].filter(Boolean).join(', ');
}

// ---------------------------------------------------------------- Wochenplan

/**
 * Was laut Phase an einem Wochentag dran ist. Der Klausurmodus blendet alle
 * Tage außer Montag, Dienstag und Freitag aus, ohne den Plan selbst zu ändern.
 */
export function resolveDay(phase, weekday, examMode) {
  if (examMode && !EXAM_DAYS.includes(weekday)) {
    return { rest: true, exam: true, note: 'Klausurmodus: frei' };
  }
  const day = phase?.weekplan?.[weekday];
  if (!day || (!day.unitId && !day.before && !day.after)) {
    return { rest: true, exam: false, note: day?.note || 'Frei' };
  }
  return { rest: false, exam: false, ...day };
}

export function dayTitle(day, unitName) {
  if (day.rest) return day.note || 'Frei';
  if (day.title) return day.title;
  if (unitName) return unitName;
  const block = day.before || day.after;
  return block ? cardioSummary(block) : 'Training';
}

/** true, wenn die Phase noch an keinem Tag etwas geplant hat (Phase 4 am Anfang). */
export function phaseIsEmpty(phase) {
  return WEEKDAYS.every((wd) => resolveDay(phase, wd, false).rest);
}

// ---------------------------------------------------------------- Backup

export const BACKUP_MAX_DAYS = 14;

/**
 * Erinnerung, wenn das letzte Backup älter als 14 Tage ist. Ohne Backup zählt
 * der erste Start der App, damit die Erinnerung nicht schon am ersten Tag kommt.
 */
export function backupStatus(lastBackupAt, installedAt, now) {
  const ref = lastBackupAt ?? installedAt ?? null;
  if (ref == null) return { due: false, days: null, never: lastBackupAt == null };
  const days = Math.floor((now - ref) / 86_400_000);
  return { due: days > BACKUP_MAX_DAYS, days, never: lastBackupAt == null };
}

// ---------------------------------------------------------------- Verlauf

/** Bester Wert eines Eintrags für das Diagramm: Gewicht, sonst Wiederholungen oder Haltezeit. */
export function entryValue(entry) {
  const done = entry.sets.filter((s) => s.done);
  if (!done.length) return null;
  const values = done
    .map((s) => (entry.weighted && s.weight != null ? s.weight : setValue(entry, s)))
    .filter((v) => v != null);
  return values.length ? Math.max(...values) : null;
}

export function entryValueUnit(entry) {
  const anyWeight = entry.weighted && entry.sets.some((s) => s.done && s.weight != null);
  if (anyWeight) return 'kg';
  return entry.mode === 'hold' ? 's' : 'Wdh.';
}

/** Höchster Knieschmerz und schlechteste Farbe pro Training. */
export function trainingKnee(training, check) {
  const rated = training.entries.filter((e) => e.kneeCheck && !e.skipped && e.knee);
  if (!rated.length) return null;
  return {
    pain: Math.max(...rated.map((e) => e.knee.pain ?? 0)),
    color: rated.map((e) => effectiveColor(e, check)).reduce(worseColor, null),
  };
}
