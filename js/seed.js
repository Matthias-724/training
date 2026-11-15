// Startdaten: der Plan aus AUFTRAG.md mit den abgestimmten Änderungen.
//
// Abweichungen vom Auftrag, alle mit dem Nutzer besprochen:
// - Oberkörper als Drücken/Ziehen-Split, Klimmzüge am Ziehen-Tag
// - Donnerstag: Rad Zone 2, danach Core, Stabilität und Mobilität
// - Freitag nur noch Beine Prehab B (vorher 16 Übungen)
// - "Gerades Beinheben" in Prehab A
// - sitzende Varianten für Face Pulls, Curls und Trizeps
// - zu jeder Übung Ersatzübungen für "Tauschen"
// - Phase 2a: gesundes Bein trainieren, falls der Operateur zustimmt
//
// Die IDs sind stabil. Trainingslogs verweisen auf sie, und ein späteres
// Plan-Update kann damit gezielt einzelne Übungen ergänzen.

export const SEED_VERSION = 1;

export const CATEGORIES = {
  oberkoerper: 'Oberkörper',
  rumpf: 'Rumpf',
  beine: 'Beine',
  stabilitaet: 'Stabilität',
  mobilitaet: 'Mobilität',
  ausdauer: 'Ausdauer',
};

export const DEFAULT_TABU = [
  'Laufen',
  'Springen',
  'Richtungswechsel',
  'Drehbewegungen auf dem Bein',
  'Padel',
  'Tiefe Kniebeugen mit Schmerz',
  'Ausfallschritte mit Rotation',
  'Brustbeinschlag beim Schwimmen',
];

function ex(id, name, category, sets, mode, min, max, opts = {}) {
  return {
    id,
    name,
    category,
    sets,
    mode, // 'reps' = Wiederholungen, 'hold' = Haltezeit in Sekunden
    min,
    max: max ?? min,
    perSide: false,
    weighted: mode === 'reps',
    assisted: false, // Gewicht ist Unterstützung: weniger ist schwerer
    restSec: 90,
    hint: '',
    kneeCheck: category === 'beine' || category === 'stabilitaet',
    paused: false,
    pausedSince: null,
    alternatives: [],
    ...opts,
  };
}

const HEALTHY_LEG = 'Nur mit Freigabe des Operateurs. Das operierte Bein bleibt unbelastet.';
const STAND_FIRM = 'Fester Stand auf beiden Beinen, nicht drehen.';

function exercises() {
  return [
    // ---- Drücken
    ex('bankdruecken', 'Bankdrücken', 'oberkoerper', 4, 'reps', 6, 8, { restSec: 120, alternatives: ['kh-bankdruecken', 'brustpresse'] }),
    ex('schraegbank-kh', 'Schrägbankdrücken Kurzhanteln', 'oberkoerper', 3, 'reps', 8, 10, { alternatives: ['schraegbank-multipresse'] }),
    ex('schulterdruecken-sitzend', 'Schulterdrücken sitzend', 'oberkoerper', 3, 'reps', 8, 10, { alternatives: ['schulterpresse-maschine'] }),
    ex('dips-maschine', 'Dips an der Maschine oder Brustpresse', 'oberkoerper', 3, 'reps', 10, 12, { alternatives: ['enges-bankdruecken', 'brustpresse'] }),
    ex('seitheben-sitzend', 'Seitheben sitzend', 'oberkoerper', 3, 'reps', 12, 12, { alternatives: ['seitheben-maschine'] }),
    ex('trizeps-ueberkopf', 'Trizepsdrücken über Kopf sitzend', 'oberkoerper', 3, 'reps', 12, 12, { hint: 'Mit Kurzhantel oder am Kabel, im Sitzen.', alternatives: ['trizepsmaschine', 'trizeps-kabel-stehend'] }),

    // ---- Ziehen
    ex('klimmzuege', 'Klimmzüge mit Unterstützung', 'oberkoerper', 3, 'reps', 6, 10, { restSec: 120, assisted: true, hint: 'Als Gewicht die Unterstützung eintragen. Kontrolliert ein- und aussteigen, nicht abspringen.', alternatives: ['latzug-untergriff'] }),
    ex('latzug', 'Latzug', 'oberkoerper', 4, 'reps', 8, 10, { restSec: 120, alternatives: ['latzug-untergriff'] }),
    ex('rudern-kabel', 'Rudern am Kabel sitzend', 'oberkoerper', 3, 'reps', 10, 10, { alternatives: ['tbar-rudern', 'rudern-maschine'] }),
    ex('rudern-maschine', 'Rudern an der Maschine mit Brustauflage', 'oberkoerper', 3, 'reps', 10, 10, { alternatives: ['kh-rudern-schraegbank'] }),
    ex('face-pulls-sitzend', 'Face Pulls sitzend', 'oberkoerper', 3, 'reps', 15, 15, { hint: 'Seilzug im Sitzen auf Kopfhöhe einstellen.', alternatives: ['reverse-butterfly', 'face-pulls-stehend'] }),
    ex('bizepscurls-sitzend', 'Bizepscurls sitzend', 'oberkoerper', 3, 'reps', 10, 12, { alternatives: ['bizepsmaschine'] }),
    ex('hammercurls-sitzend', 'Hammercurls sitzend', 'oberkoerper', 3, 'reps', 12, 12, { alternatives: ['bizepsmaschine'] }),

    // ---- Oberkörper: Ersatz und Phase 2a
    ex('kh-bankdruecken', 'Kurzhantel-Bankdrücken', 'oberkoerper', 4, 'reps', 6, 8, { restSec: 120 }),
    ex('brustpresse', 'Brustpresse', 'oberkoerper', 3, 'reps', 10, 10, { alternatives: ['kh-bankdruecken'] }),
    ex('schraegbank-multipresse', 'Schrägbankdrücken an der Multipresse', 'oberkoerper', 3, 'reps', 8, 10),
    ex('schulterpresse-maschine', 'Schulterdrücken an der Maschine', 'oberkoerper', 3, 'reps', 10, 10, { alternatives: ['schulterdruecken-sitzend'] }),
    ex('enges-bankdruecken', 'Enges Bankdrücken', 'oberkoerper', 3, 'reps', 8, 10),
    ex('seitheben-maschine', 'Seitheben an der Maschine', 'oberkoerper', 3, 'reps', 12, 12),
    ex('trizepsmaschine', 'Trizepsmaschine sitzend', 'oberkoerper', 3, 'reps', 12, 12),
    ex('trizeps-kabel-stehend', 'Trizepsdrücken am Kabel stehend', 'oberkoerper', 3, 'reps', 12, 12, { hint: STAND_FIRM }),
    ex('latzug-untergriff', 'Latzug mit Untergriff', 'oberkoerper', 3, 'reps', 8, 10),
    ex('tbar-rudern', 'T-Bar-Rudern mit Brustauflage', 'oberkoerper', 3, 'reps', 10, 10),
    ex('kh-rudern-schraegbank', 'Kurzhantelrudern bäuchlings auf der Schrägbank', 'oberkoerper', 3, 'reps', 10, 10, { hint: 'Brust liegt auf der Bank, kein Bein trägt Last.' }),
    ex('rudern-einarmig', 'Rudern einarmig', 'oberkoerper', 3, 'reps', 10, 10, { perSide: true, hint: 'Knie des gesunden Beins auf der Bank.', alternatives: ['kh-rudern-schraegbank'] }),
    ex('reverse-butterfly', 'Reverse Butterfly an der Maschine', 'oberkoerper', 3, 'reps', 15, 15),
    ex('face-pulls-stehend', 'Face Pulls stehend', 'oberkoerper', 3, 'reps', 15, 15, { hint: STAND_FIRM }),
    ex('bizepsmaschine', 'Bizepsmaschine', 'oberkoerper', 3, 'reps', 10, 12),

    // ---- Rumpf
    ex('unterarmstuetz', 'Unterarmstütz', 'rumpf', 3, 'hold', 45, 45, { weighted: false, restSec: 60, alternatives: ['hollow-hold'] }),
    ex('seitstuetz', 'Seitstütz', 'rumpf', 3, 'hold', 30, 30, { weighted: false, perSide: true, restSec: 60, alternatives: ['seitstuetz-knie'] }),
    ex('pallof', 'Pallof Press im Sitzen oder kniend', 'rumpf', 3, 'reps', 10, 10, { perSide: true, restSec: 60, hint: 'Kniend nur auf dem gesunden Knie.' }),
    ex('dead-bug', 'Dead Bug', 'rumpf', 3, 'reps', 10, 10, { perSide: true, weighted: false, restSec: 60, alternatives: ['hollow-hold'] }),
    ex('cable-crunch', 'Cable Crunch', 'rumpf', 3, 'reps', 12, 12, { restSec: 60, hint: 'Kniend auf weicher Unterlage. Drückt es am Knie, tauschen.', alternatives: ['bauchmaschine'] }),
    ex('hollow-hold', 'Hollow Hold', 'rumpf', 3, 'hold', 20, 30, { weighted: false, restSec: 60 }),
    ex('seitstuetz-knie', 'Seitstütz auf den Knien', 'rumpf', 3, 'hold', 30, 30, { weighted: false, perSide: true, restSec: 60, hint: 'Kürzerer Hebel, weniger seitliche Last auf das Knie.' }),
    ex('bauchmaschine', 'Bauchmaschine sitzend', 'rumpf', 3, 'reps', 12, 12, { restSec: 60 }),
    ex('crunch-boden', 'Crunch am Boden', 'rumpf', 3, 'reps', 15, 15, { weighted: false, restSec: 60, alternatives: ['bauchmaschine'] }),

    // ---- Beine Prehab A
    ex('quad-sets', 'Quadrizeps anspannen in Streckung', 'beine', 3, 'reps', 10, 10, { weighted: false, restSec: 45, hint: 'Kissen unter der Ferse, jede Wiederholung 5 s halten. Volle Streckung ist das wichtigste Ziel vor der OP.' }),
    ex('gerades-beinheben', 'Gerades Beinheben', 'beine', 3, 'reps', 10, 10, { restSec: 60, hint: 'Erst den Oberschenkel anspannen, dann das gestreckte Bein anheben. Knickt das Knie dabei ein, ist das Ziel noch nicht erreicht. Gewicht nur mit Manschette.' }),
    ex('beinpresse', 'Beinpresse beidbeinig', 'beine', 3, 'reps', 10, 12, { hint: 'Nur 0 bis 70 Grad Kniebeugung, unter Last nicht durchdrücken.', alternatives: ['goblet-box'] }),
    ex('beinpresse-einbeinig', 'Beinpresse einbeinig, beide Seiten', 'beine', 3, 'reps', 8, 10, { perSide: true, hint: 'Gleicher Bewegungsumfang auf beiden Seiten. Erst das verletzte Bein.', alternatives: ['aufstehen-einbeinig'] }),
    ex('beinbeuger', 'Beinbeuger liegend oder sitzend', 'beine', 3, 'reps', 10, 12, { hint: 'Hintere Oberschenkel entlasten das Kreuzband.', alternatives: ['beinbeuger-ball'] }),
    ex('hip-thrust', 'Hip Thrust', 'beine', 3, 'reps', 10, 10, { hint: 'Schwer möglich.', alternatives: ['hip-thrust-maschine'] }),
    ex('wadenheben', 'Wadenheben', 'beine', 3, 'reps', 15, 15, { restSec: 60, alternatives: ['wadenheben-sitzend'] }),

    // ---- Beine Prehab B
    ex('wandsitzen', 'Wandsitzen etwa 60 Grad', 'beine', 4, 'hold', 30, 45, { weighted: false, restSec: 60, hint: 'Isometrisch, meist gut verträglich.', alternatives: ['beinpresse-iso'] }),
    ex('kniestrecker', 'Kniestrecker Maschine', 'beine', 3, 'reps', 12, 12, { hint: 'Nur 90 bis 45 Grad, die letzten 45 Grad bis zur Streckung weglassen.', alternatives: ['kniestrecker-iso'] }),
    ex('rdl', 'Rumänisches Kreuzheben', 'beine', 3, 'reps', 8, 10, { restSec: 120, hint: 'Knie leicht gebeugt und fest, keine Rotation.', alternatives: ['kh-rdl', 'pull-through'] }),
    ex('step-up', 'Step-up niedrige Stufe 15 bis 20 cm', 'beine', 3, 'reps', 10, 10, { perSide: true, hint: 'Langsam, Knie über dem Fuß, nicht nach innen.', alternatives: ['beinpresse-einbeinig'] }),
    ex('abduktoren', 'Abduktorenmaschine', 'beine', 3, 'reps', 12, 12, { restSec: 60, hint: 'Polster oberhalb des Knies.', alternatives: ['seitliches-beinheben'] }),
    ex('adduktoren', 'Adduktorenmaschine', 'beine', 3, 'reps', 12, 12, { restSec: 60, hint: 'Polster oberhalb des Knies.', alternatives: ['ball-adduktion'] }),
    ex('glute-bridge-einbeinig', 'Glute Bridge einbeinig', 'beine', 3, 'reps', 10, 10, { perSide: true, restSec: 60, alternatives: ['hip-thrust-einbeinig'] }),

    // ---- Beine: Ersatz
    ex('goblet-box', 'Goblet-Kniebeuge auf eine hohe Box', 'beine', 3, 'reps', 10, 12, { hint: 'Box so hoch, dass das Knie höchstens 70 Grad gebeugt ist. Gerade nach unten, nicht drehen.' }),
    ex('aufstehen-einbeinig', 'Einbeinig von einer hohen Bank aufstehen', 'beine', 3, 'reps', 8, 10, { perSide: true, weighted: false, hint: 'Bank hoch genug wählen, Knie über dem Fuß, langsam.' }),
    ex('beinbeuger-ball', 'Beinbeuger mit Gymnastikball', 'beine', 3, 'reps', 10, 12, { weighted: false, hint: 'Rückenlage, Fersen auf dem Ball, Becken oben halten.' }),
    ex('hip-thrust-maschine', 'Hip-Thrust-Maschine', 'beine', 3, 'reps', 10, 10),
    ex('wadenheben-sitzend', 'Wadenheben sitzend', 'beine', 3, 'reps', 15, 15, { restSec: 60 }),
    ex('beinpresse-iso', 'Beinpresse halten bei etwa 60 Grad', 'beine', 4, 'hold', 30, 45, { weighted: true, restSec: 60, hint: 'Isometrisch: Gewicht halten, ohne zu bewegen.' }),
    ex('kniestrecker-iso', 'Kniestrecker halten bei 60 bis 90 Grad', 'beine', 4, 'hold', 30, 45, { weighted: true, restSec: 60, hint: 'Gegen den Widerstand halten, nicht strecken.' }),
    ex('kh-rdl', 'Rumänisches Kreuzheben mit Kurzhanteln', 'beine', 3, 'reps', 8, 10, { restSec: 120, hint: 'Knie leicht gebeugt und fest, keine Rotation.' }),
    ex('pull-through', 'Pull-Through am Kabel', 'beine', 3, 'reps', 10, 12, { hint: 'Hüfte nach hinten schieben, Knie leicht gebeugt, nicht drehen.' }),
    ex('seitliches-beinheben', 'Seitliches Beinheben liegend', 'beine', 3, 'reps', 12, 15, { perSide: true, weighted: false, restSec: 60 }),
    ex('ball-adduktion', 'Ball zwischen den Oberschenkeln drücken', 'beine', 3, 'reps', 12, 12, { weighted: false, restSec: 60, hint: 'In Rückenlage, jede Wiederholung 5 s halten.' }),
    ex('hip-thrust-einbeinig', 'Hip Thrust einbeinig', 'beine', 3, 'reps', 10, 10, { perSide: true, restSec: 60 }),

    // ---- Gesundes Bein in Phase 2a (keine Knie-Ampel, das operierte Knie arbeitet nicht)
    ex('gb-kniestrecker', 'Kniestrecker einbeinig, gesundes Bein', 'beine', 3, 'reps', 10, 12, { kneeCheck: false, hint: HEALTHY_LEG }),
    ex('gb-beinbeuger', 'Beinbeuger einbeinig, gesundes Bein', 'beine', 3, 'reps', 10, 12, { kneeCheck: false, hint: HEALTHY_LEG }),
    ex('gb-beinpresse', 'Beinpresse einbeinig, gesundes Bein', 'beine', 3, 'reps', 10, 12, { kneeCheck: false, hint: `${HEALTHY_LEG} Ein- und Aussteigen nur, wenn es mit Krücken sicher geht.` }),

    // ---- Stabilität
    ex('einbeinstand', 'Einbeinstand verletztes Bein', 'stabilitaet', 3, 'hold', 30, 30, { weighted: false, restSec: 45, hint: 'An der Wand absichern. Nicht drehen.', alternatives: ['einbeinstand-matte'] }),
    ex('einbeinstand-matte', 'Einbeinstand auf weicher Matte', 'stabilitaet', 3, 'hold', 30, 30, { weighted: false, restSec: 45, hint: 'Erst wenn der feste Boden leicht fällt. Wand in Reichweite, nicht drehen.' }),

    // ---- Mobilität
    ex('fersenrutschen', 'Fersenrutschen im Liegen', 'mobilitaet', 2, 'reps', 15, 15, { weighted: false, restSec: 30, kneeCheck: true, hint: 'Für die Beugung.', alternatives: ['wall-slides'] }),
    ex('streckung-sitzend', 'Streckung im Sitzen, Ferse erhöht', 'mobilitaet', 3, 'hold', 60, 60, { weighted: false, restSec: 30, kneeCheck: true, hint: 'Ferse auf einer Erhöhung, das Knie hängt frei durch. Volle Streckung ist das wichtigste Ziel vor der OP.', alternatives: ['prone-hang'] }),
    ex('hueftbeuger', 'Hüftbeuger dehnen kniend', 'mobilitaet', 2, 'hold', 45, 45, { weighted: false, restSec: 30, kneeCheck: true, hint: 'Auf dem gesunden Knie kniend.', alternatives: ['thomas-dehnung'] }),
    ex('bws-rotation', 'Brustwirbelsäule rotieren im Vierfüßlerstand', 'mobilitaet', 2, 'reps', 10, 10, { weighted: false, restSec: 30, kneeCheck: false, alternatives: ['open-book'] }),
    ex('wall-slides', 'Fersenrutschen an der Wand', 'mobilitaet', 2, 'reps', 15, 15, { weighted: false, restSec: 30, kneeCheck: true, hint: 'Rückenlage, den Fuß an der Wand nach unten gleiten lassen.' }),
    ex('prone-hang', 'Streckung in Bauchlage', 'mobilitaet', 3, 'hold', 60, 60, { weighted: false, restSec: 30, kneeCheck: true, hint: 'Bauchlage, die Unterschenkel über das Bankende hängen lassen.' }),
    ex('thomas-dehnung', 'Hüftbeuger dehnen in Rückenlage an der Bankkante', 'mobilitaet', 2, 'hold', 45, 45, { weighted: false, restSec: 30, kneeCheck: false }),
    ex('open-book', 'Open Book in Seitenlage', 'mobilitaet', 2, 'reps', 10, 10, { weighted: false, perSide: true, restSec: 30, kneeCheck: false }),
  ];
}

function unit(id, name, exerciseIds, hint = '') {
  return { id, name, exerciseIds, hint };
}

const P2_HINT = 'Das operierte Bein nur so belasten, wie es die Arztfreigabe erlaubt.';
const LEG_HINT = 'Erst das verletzte Bein, das gesunde Bein normal schwer. Nach jeder Übung fragt die App die Knie-Ampel ab.';

function units() {
  return [
    unit('u-druecken', 'Brust, Schultern, Trizeps',
      ['bankdruecken', 'schraegbank-kh', 'schulterdruecken-sitzend', 'dips-maschine', 'seitheben-sitzend', 'trizeps-ueberkopf'],
      'Im Sitzen oder Liegen trainieren.'),
    unit('u-beine-a', 'Beine Prehab A',
      ['quad-sets', 'gerades-beinheben', 'beinpresse', 'beinpresse-einbeinig', 'beinbeuger', 'hip-thrust', 'wadenheben'],
      LEG_HINT),
    unit('u-ziehen', 'Rücken, Bizeps, Klimmzüge',
      ['klimmzuege', 'latzug', 'rudern-kabel', 'rudern-maschine', 'face-pulls-sitzend', 'bizepscurls-sitzend', 'hammercurls-sitzend'],
      'Klimmzüge zuerst, solange du frisch bist. Alles andere im Sitzen.'),
    unit('u-core', 'Core, Stabilität, Mobilität',
      ['unterarmstuetz', 'seitstuetz', 'pallof', 'dead-bug', 'cable-crunch', 'einbeinstand', 'fersenrutschen', 'streckung-sitzend', 'hueftbeuger', 'bws-rotation']),
    unit('u-beine-b', 'Beine Prehab B',
      ['wandsitzen', 'kniestrecker', 'rdl', 'step-up', 'abduktoren', 'adduktoren', 'glute-bridge-einbeinig'],
      LEG_HINT),

    unit('u-2a-druecken', 'Drücken und Rumpf am Boden',
      ['bankdruecken', 'schraegbank-kh', 'schulterdruecken-sitzend', 'dips-maschine', 'seitheben-sitzend', 'trizeps-ueberkopf', 'dead-bug', 'crunch-boden', 'pallof', 'unterarmstuetz'],
      P2_HINT),
    unit('u-2a-ziehen', 'Ziehen und gesundes Bein',
      ['latzug', 'rudern-maschine', 'face-pulls-sitzend', 'bizepscurls-sitzend', 'hammercurls-sitzend', 'gb-kniestrecker', 'gb-beinbeuger', 'gb-beinpresse'],
      `${P2_HINT} Ohne Klimmzüge. Rudern am Kabel fehlt, weil die Füße dort gegen die Platte drücken.`),
    unit('u-2a-komplett', 'Oberkörper komplett, Rumpf und gesundes Bein',
      ['brustpresse', 'schulterpresse-maschine', 'latzug-untergriff', 'kh-rudern-schraegbank', 'dead-bug', 'crunch-boden', 'pallof', 'gb-kniestrecker', 'gb-beinbeuger', 'gb-beinpresse'],
      `${P2_HINT} Ohne Klimmzüge und Rudern einarmig.`),
    unit('u-physio', 'Physio-Übungen', [],
      'Die Übungen vom Physio hier im Plan eintragen.'),
  ];
}

const cardio = (types, min, max, opts = {}) => ({ types, min, max: max ?? min, zone2: false, text: '', ...opts });
const day = (unitId, opts = {}) => ({ unitId, title: '', before: null, after: null, note: '', ...opts });
const rest = (note = '') => day(null, { note });

function phase1Week() {
  return {
    mo: day('u-druecken', { before: cardio(['ergometer'], 15, 15, { text: 'locker' }) }),
    di: day('u-beine-a', { after: cardio(['rad_indoor'], 30, 30, { text: 'locker' }) }),
    mi: day('u-ziehen', { after: cardio(['schwimmen', 'rad_indoor'], 30, 30, { text: 'Pull-Buoy beim Schwimmen' }) }),
    do: day('u-core', { title: 'Rad, Core, Stabilität, Mobilität', before: cardio(['rad_indoor'], 45, 60, { zone2: true }) }),
    fr: day('u-beine-b', { before: cardio(['ergometer'], 15, 15, { text: 'locker' }) }),
    sa: day(null, { title: 'Lange Ausdauer', before: cardio(['rad_indoor', 'schwimmen'], 60, 90, { zone2: true }) }),
    so: rest('Frei, Spaziergang'),
  };
}

function phase2aWeek(withErgometer) {
  const ergo = withErgometer ? cardio(['ergometer'], 15, 20, { text: 'ohne Widerstand' }) : null;
  return {
    mo: day('u-2a-druecken'),
    di: day('u-physio', { after: ergo }),
    mi: day('u-2a-ziehen'),
    do: day('u-physio', { after: ergo }),
    fr: day('u-2a-komplett'),
    sa: day('u-physio'),
    so: rest('Frei'),
  };
}

function emptyWeek() {
  return { mo: rest(), di: rest(), mi: rest(), do: rest(), fr: rest(), sa: rest(), so: rest() };
}

const P2_BASE = 'Was erlaubt ist, bestimmt der Operateur. Belastung und Bewegungsumfang laut Arztfreigabe eintragen.';

function phases() {
  return [
    {
      id: 'p1', order: 1, group: 'p1', name: 'Phase 1', title: 'Prehab bis zur ersten OP', locked: false,
      hint: 'Ziel ist maximale Oberschenkelkraft, volle Streckung und keine Schwellung vor der OP. Oberkörper im Sitzen oder Liegen trainieren. Das gesunde Bein normal schwer trainieren.',
      weekplan: phase1Week(),
    },
    {
      id: 'p2a', order: 2, group: 'p2', name: 'Phase 2a', title: 'Nach der ersten OP, ab Woche 1 bis 2', locked: false,
      hint: `${P2_BASE} In 2a: Oberkörper im Sitzen, Rumpf am Boden, Physio-Übungen. Das gesunde Bein nur trainieren, wenn der Operateur zustimmt.`,
      weekplan: phase2aWeek(false),
    },
    {
      id: 'p2b', order: 3, group: 'p2', name: 'Phase 2b', title: 'Ab etwa Woche 4 bis 6 nach Freigabe', locked: true,
      hint: `${P2_BASE} In 2b kommt Ergometer ohne Widerstand dazu, 15 bis 20 Minuten.`,
      weekplan: phase2aWeek(true),
    },
    {
      id: 'p2c', order: 4, group: 'p2', name: 'Phase 2c', title: 'Ab Vollbelastung nach Freigabe', locked: true,
      hint: `${P2_BASE} In 2c gilt der Wochenplan wie in Phase 1. Prehab A und B schrittweise mit leichten Gewichten beginnen.`,
      weekplan: phase1Week(),
    },
    {
      id: 'p3', order: 5, group: 'p3', name: 'Phase 3', title: 'Zwischen den OPs', locked: false,
      hint: 'Das Kreuzband fehlt weiterhin. Kein Laufen, kein Padel. Diese Phase ist die eigentliche Vorbereitung auf die Kreuzband-OP: Streckung, Schwellung und Kraft im Seitenvergleich regelmäßig vom Physio messen lassen, Ziel weniger als 20 Prozent Defizit.',
      weekplan: phase1Week(),
    },
    {
      id: 'p4', order: 6, group: 'p4', name: 'Phase 4', title: 'Nach der zweiten OP', locked: false,
      hint: 'Normale Kreuzband-Reha nach Vorgabe von Operateur und Physio. Geradeaus laufen erst nach Freigabe anhand von Kriterien, meist frühestens nach 3 bis 4 Monaten. Padel und Sport mit Richtungswechseln erst nach bestandenem Return-to-Sport-Test, frühestens nach 9 Monaten.',
      weekplan: emptyWeek(),
    },
  ];
}

/** Frische Kopie der Startdaten. Jeder Aufruf liefert neue Objekte. */
export function buildSeed() {
  return { exercises: exercises(), units: units(), phases: phases() };
}
