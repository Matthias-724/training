// Startdaten: der Plan aus AUFTRAG.md mit den abgestimmten Änderungen.
//
// Version 1 (mit dem Nutzer besprochen):
// - Oberkörper als Drücken/Ziehen-Split, Klimmzüge am Ziehen-Tag
// - Donnerstag: Rad Zone 2, danach Core und Mobilität
// - Freitag nur noch Beine Prehab B (vorher 16 Übungen)
// - sitzende Varianten für Face Pulls, Curls und Trizeps
// - zu jeder Übung Ersatzübungen für "Tauschen"
// - Phase 2a: gesundes Bein trainieren, falls der Operateur zustimmt
//
// Version 2 (nach der Prehab-Recherche des Nutzers):
// - tägliche Einheit für Streckung und Quadrizeps-Ansteuerung (Priorität 1)
// - Beintage mit Störungstraining am Anfang, solange man frisch ist
//   (einzige Stabilisationsform mit RCT-Evidenz, Fitzgerald 2000)
// - gesundes Bein mit eigenen, schweren Sätzen (Cross-Education)
// - Beinpresse und Kniestrecker mit 4 Sätzen, Hamstrings 8 bis 12
// - Hüftaußenrotation (Clamshell) und Spanish Squat für Schmerztage
// - Stabilität und Streckung nicht mehr am Donnerstag, sondern an den
//   Beintagen bzw. täglich
//
// Die IDs sind stabil. Trainingslogs verweisen auf sie, und mergeSeedUpdate
// kann damit neue Startdaten übernehmen, ohne eigene Übungen zu verlieren.

export const SEED_VERSION = 2;

export const CATEGORIES = {
  oberkoerper: 'Oberkörper',
  rumpf: 'Rumpf',
  beine: 'Beine',
  stabilitaet: 'Stabilität',
  mobilitaet: 'Mobilität',
  ausdauer: 'Ausdauer',
};

/** Tabu-Liste der ersten Version. Nur zum Erkennen, ob der Nutzer sie geändert hat. */
export const TABU_V1 = [
  'Laufen',
  'Springen',
  'Richtungswechsel',
  'Drehbewegungen auf dem Bein',
  'Padel',
  'Tiefe Kniebeugen mit Schmerz',
  'Ausfallschritte mit Rotation',
  'Brustbeinschlag beim Schwimmen',
];

export const DEFAULT_TABU = [
  'Laufen',
  'Springen',
  'Richtungswechsel',
  'Drehbewegungen auf dem Bein',
  'Padel',
  'Kniestrecken mit Last zwischen 0 und 45 Grad',
  'Tiefe Kniebeugen oder Ausfallschritte mit Gewicht',
  'Ausfallschritte mit Rotation',
  'Brustbeinschlag beim Schwimmen',
  'Training trotz roter Ampel (Erguss, Blockade, Wegknicken)',
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
    pausedReason: null, // 'schmerz' oder 'warnzeichen'
    alternatives: [],
    ...opts,
  };
}

const CROSS_ED = 'Gesundes Bein schwer trainieren, voller Bewegungsumfang erlaubt. Es ist später die Referenz für die Kraftmessung und das Standbein bei Teilbelastung. Nach einer OP nur mit Freigabe des Operateurs.';
const STAND_FIRM = 'Fester Stand auf beiden Beinen, nicht drehen.';
const RIR = '1 bis 3 Wiederholungen im Tank lassen.';

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
    ex('seitstuetz', 'Seitstütz', 'rumpf', 3, 'hold', 30, 30, { weighted: false, perSide: true, restSec: 60, hint: 'Auch für die Hüftkontrolle.', alternatives: ['seitstuetz-knie'] }),
    ex('pallof', 'Pallof Press im Sitzen oder kniend', 'rumpf', 3, 'reps', 10, 10, { perSide: true, restSec: 60, hint: 'Kniend nur auf dem gesunden Knie.' }),
    ex('dead-bug', 'Dead Bug', 'rumpf', 3, 'reps', 10, 10, { perSide: true, weighted: false, restSec: 60, alternatives: ['hollow-hold'] }),
    ex('cable-crunch', 'Cable Crunch', 'rumpf', 3, 'reps', 12, 12, { restSec: 60, hint: 'Kniend auf weicher Unterlage. Drückt es am Knie, tauschen.', alternatives: ['bauchmaschine'] }),
    ex('hollow-hold', 'Hollow Hold', 'rumpf', 3, 'hold', 20, 30, { weighted: false, restSec: 60 }),
    ex('seitstuetz-knie', 'Seitstütz auf den Knien', 'rumpf', 3, 'hold', 30, 30, { weighted: false, perSide: true, restSec: 60, hint: 'Kürzerer Hebel, weniger seitliche Last auf das Knie.' }),
    ex('bauchmaschine', 'Bauchmaschine sitzend', 'rumpf', 3, 'reps', 12, 12, { restSec: 60 }),
    ex('crunch-boden', 'Crunch am Boden', 'rumpf', 3, 'reps', 15, 15, { weighted: false, restSec: 60, alternatives: ['bauchmaschine'] }),

    // ---- Täglich: Streckung und Quadrizeps-Ansteuerung
    // Ohne Knie-Ampel: Sonst wäre jeder Tag ein Beintag mit Kniecheck am Morgen.
    ex('streckung-sitzend', 'Streckung: Ferse hochlagern', 'mobilitaet', 2, 'hold', 300, 600, { weighted: false, restSec: 30, kneeCheck: false, hint: 'Ferse auf einer Erhöhung, das Knie hängt frei durch. Ziel ist die seitengleiche Streckung, das wichtigste Ziel vor der OP.', alternatives: ['prone-hang'] }),
    ex('quad-sets', 'Quadrizeps anspannen in Streckung', 'beine', 3, 'reps', 10, 15, { weighted: false, restSec: 30, kneeCheck: false, hint: 'Kniescheibe nach oben ziehen, jede Wiederholung 5 s halten. Bei Schmerz oder Schwellung vorher 15 bis 20 Minuten kühlen.' }),
    ex('gerades-beinheben', 'Gerades Beinheben', 'beine', 3, 'reps', 10, 15, { restSec: 45, kneeCheck: false, hint: 'Erst den Oberschenkel anspannen, dann das gestreckte Bein anheben. Knickt das Knie dabei ein (Streckdefizit), ist das Ziel noch nicht erreicht. Gewicht nur mit Manschette.' }),

    // ---- Störungstraining (an beiden Beintagen zuerst)
    ex('einbeinstand-stoerung', 'Einbeinstand mit Störung', 'stabilitaet', 3, 'hold', 30, 30, { weighted: false, restSec: 45, hint: 'Verletztes Bein, fester Boden. Ball fangen oder leichte Stöße von einem Partner, Wand in Reichweite, nicht drehen. Störungstraining beim Physio ist noch besser belegt.', alternatives: ['einbeinstand', 'einbeinstand-matte'] }),
    ex('einbeinstand', 'Einbeinstand verletztes Bein', 'stabilitaet', 3, 'hold', 30, 30, { weighted: false, restSec: 45, hint: 'An der Wand absichern. Nicht drehen.', alternatives: ['einbeinstand-matte'] }),
    ex('einbeinstand-matte', 'Einbeinstand auf weicher Matte', 'stabilitaet', 3, 'hold', 30, 30, { weighted: false, restSec: 45, hint: 'Nur als Zusatz, ersetzt kein Krafttraining. Wand in Reichweite, nicht drehen.' }),

    // ---- Beine Prehab A: geschlossene Kette und Hamstrings
    ex('beinpresse', 'Beinpresse beidbeinig', 'beine', 4, 'reps', 6, 12, { restSec: 120, hint: `Nur 0 bis 60, höchstens 70 Grad Kniebeugung, unter Last nicht durchdrücken. ${RIR}`, alternatives: ['goblet-box'] }),
    ex('beinpresse-einbeinig', 'Beinpresse einbeinig, verletztes Bein', 'beine', 3, 'reps', 8, 12, { hint: `Gleicher Bewegungsumfang wie beidbeinig. ${RIR}`, alternatives: ['aufstehen-einbeinig'] }),
    ex('gb-beinpresse', 'Beinpresse einbeinig, gesundes Bein', 'beine', 3, 'reps', 6, 10, { kneeCheck: false, hint: CROSS_ED }),
    ex('beinbeuger', 'Beinbeuger liegend oder sitzend', 'beine', 3, 'reps', 8, 12, { hint: 'Hintere Oberschenkel entlasten das Kreuzband. Ist für OP 2 ein Hamstring-Transplantat geplant, mit dem Operateur absprechen.', alternatives: ['beinbeuger-ball'] }),
    ex('hip-thrust', 'Hip Thrust', 'beine', 3, 'reps', 8, 12, { hint: 'Schwer möglich.', alternatives: ['hip-thrust-maschine', 'glute-bridge-einbeinig'] }),
    ex('wadenheben', 'Wadenheben', 'beine', 3, 'reps', 12, 15, { restSec: 60, hint: 'Auch einbeinig möglich.', alternatives: ['wadenheben-sitzend'] }),

    // ---- Beine Prehab B: Quadrizeps 90 bis 45 Grad, Isometrie, Hüfte
    ex('wandsitzen', 'Wandsitzen etwa 60 Grad', 'beine', 4, 'hold', 30, 45, { weighted: false, restSec: 60, hint: 'Isometrisch, meist gut verträglich.', alternatives: ['spanish-squat', 'beinpresse-iso'] }),
    ex('kniestrecker', 'Kniestrecker Maschine', 'beine', 4, 'reps', 8, 12, { hint: `Nur 90 bis 45 Grad, Anschlag an der Maschine einstellen. Die letzten 45 Grad bis zur Streckung unter Last weglassen. ${RIR}`, alternatives: ['kniestrecker-iso', 'spanish-squat'] }),
    ex('gb-kniestrecker', 'Kniestrecker einbeinig, gesundes Bein', 'beine', 3, 'reps', 6, 10, { kneeCheck: false, hint: CROSS_ED }),
    ex('rdl', 'Rumänisches Kreuzheben', 'beine', 3, 'reps', 8, 10, { restSec: 120, hint: 'Knie leicht gebeugt und fest, keine Rotation.', alternatives: ['kh-rdl', 'pull-through'] }),
    ex('step-up', 'Step-up niedrige Stufe 15 bis 20 cm', 'beine', 3, 'reps', 10, 10, { perSide: true, hint: 'Langsam, Knie über dem Fuß, nicht nach innen.', alternatives: ['beinpresse-einbeinig'] }),
    ex('abduktoren', 'Abduktorenmaschine', 'beine', 3, 'reps', 10, 15, { restSec: 60, hint: 'Polster oberhalb des Knies.', alternatives: ['seitliches-beinheben', 'clamshell'] }),
    ex('clamshell', 'Clamshell mit Band', 'beine', 3, 'reps', 12, 15, { perSide: true, weighted: false, restSec: 45, hint: 'Hüftaußenrotation. Seitenlage, Knie gebeugt, Füße zusammen. Das obere Knie gegen das Band öffnen, Becken bleibt ruhig.' }),

    // ---- Beine: Ersatz
    ex('adduktoren', 'Adduktorenmaschine', 'beine', 3, 'reps', 12, 12, { restSec: 60, hint: 'Polster oberhalb des Knies.', alternatives: ['ball-adduktion'] }),
    ex('glute-bridge-einbeinig', 'Glute Bridge einbeinig', 'beine', 3, 'reps', 10, 10, { perSide: true, restSec: 60, alternatives: ['hip-thrust-einbeinig'] }),
    ex('spanish-squat', 'Spanish Squat', 'beine', 4, 'hold', 30, 45, { weighted: false, restSec: 60, hint: 'Band hinter beiden Knien an einem festen Punkt, Schienbeine senkrecht. Auf 45 bis 90 Grad absetzen und halten. Gut an Schmerztagen.' }),
    ex('goblet-box', 'Goblet-Kniebeuge auf eine hohe Box', 'beine', 3, 'reps', 10, 12, { hint: 'Box so hoch, dass das Knie höchstens 70 Grad gebeugt ist. Gerade nach unten, nicht drehen.' }),
    ex('aufstehen-einbeinig', 'Einbeinig von einer hohen Bank aufstehen', 'beine', 3, 'reps', 8, 10, { weighted: false, hint: 'Verletztes Bein. Bank hoch genug wählen, Knie über dem Fuß, langsam.' }),
    ex('beinbeuger-ball', 'Beinbeuger mit Gymnastikball', 'beine', 3, 'reps', 10, 12, { weighted: false, hint: 'Rückenlage, Fersen auf dem Ball, Becken oben halten.' }),
    ex('hip-thrust-maschine', 'Hip-Thrust-Maschine', 'beine', 3, 'reps', 8, 12),
    ex('wadenheben-sitzend', 'Wadenheben sitzend', 'beine', 3, 'reps', 12, 15, { restSec: 60 }),
    ex('beinpresse-iso', 'Beinpresse halten bei etwa 60 Grad', 'beine', 4, 'hold', 30, 45, { weighted: true, restSec: 60, hint: 'Isometrisch: Gewicht halten, ohne zu bewegen.' }),
    ex('kniestrecker-iso', 'Kniestrecker halten bei 60 bis 90 Grad', 'beine', 4, 'hold', 30, 45, { weighted: true, restSec: 60, hint: 'Gegen den Widerstand halten, nicht strecken. Gut an Schmerztagen.' }),
    ex('kh-rdl', 'Rumänisches Kreuzheben mit Kurzhanteln', 'beine', 3, 'reps', 8, 10, { restSec: 120, hint: 'Knie leicht gebeugt und fest, keine Rotation.' }),
    ex('pull-through', 'Pull-Through am Kabel', 'beine', 3, 'reps', 10, 12, { hint: 'Hüfte nach hinten schieben, Knie leicht gebeugt, nicht drehen.' }),
    ex('seitliches-beinheben', 'Seitliches Beinheben liegend', 'beine', 3, 'reps', 12, 15, { perSide: true, weighted: false, restSec: 60 }),
    ex('ball-adduktion', 'Ball zwischen den Oberschenkeln drücken', 'beine', 3, 'reps', 12, 12, { weighted: false, restSec: 60, hint: 'In Rückenlage, jede Wiederholung 5 s halten.' }),
    ex('hip-thrust-einbeinig', 'Hip Thrust einbeinig', 'beine', 3, 'reps', 10, 10, { perSide: true, restSec: 60 }),

    // ---- Gesundes Bein: Beinbeuger (Phase 2a)
    ex('gb-beinbeuger', 'Beinbeuger einbeinig, gesundes Bein', 'beine', 3, 'reps', 6, 10, { kneeCheck: false, hint: CROSS_ED }),

    // ---- Mobilität
    ex('fersenrutschen', 'Fersenrutschen im Liegen', 'mobilitaet', 2, 'reps', 15, 15, { weighted: false, restSec: 30, kneeCheck: true, hint: 'Für die Beugung. Ziel vor der OP: mindestens 120 Grad.', alternatives: ['wall-slides'] }),
    ex('hueftbeuger', 'Hüftbeuger dehnen kniend', 'mobilitaet', 2, 'hold', 45, 45, { weighted: false, restSec: 30, kneeCheck: true, hint: 'Auf dem gesunden Knie kniend.', alternatives: ['thomas-dehnung'] }),
    ex('bws-rotation', 'Brustwirbelsäule rotieren im Vierfüßlerstand', 'mobilitaet', 2, 'reps', 10, 10, { weighted: false, restSec: 30, kneeCheck: false, alternatives: ['open-book'] }),
    ex('wall-slides', 'Fersenrutschen an der Wand', 'mobilitaet', 2, 'reps', 15, 15, { weighted: false, restSec: 30, kneeCheck: true, hint: 'Rückenlage, den Fuß an der Wand nach unten gleiten lassen.' }),
    ex('prone-hang', 'Streckung in Bauchlage', 'mobilitaet', 2, 'hold', 300, 600, { weighted: false, restSec: 30, kneeCheck: false, hint: 'Bauchlage, die Unterschenkel über das Bankende hängen lassen.' }),
    ex('thomas-dehnung', 'Hüftbeuger dehnen in Rückenlage an der Bankkante', 'mobilitaet', 2, 'hold', 45, 45, { weighted: false, restSec: 30, kneeCheck: false }),
    ex('open-book', 'Open Book in Seitenlage', 'mobilitaet', 2, 'reps', 10, 10, { weighted: false, perSide: true, restSec: 30, kneeCheck: false }),
  ];
}

function unit(id, name, exerciseIds, hint = '') {
  return { id, name, exerciseIds, hint };
}

const P2_HINT = 'Das operierte Bein nur so belasten, wie es die Arztfreigabe erlaubt.';
const LEG_HINT = 'Störungstraining zuerst, solange du frisch bist. Kraft mit 1 bis 3 Wiederholungen im Tank. Erst das verletzte Bein, das gesunde Bein schwer. Bei Schmerz oder Schwellung vorher 15 bis 20 Minuten kühlen. Nach jeder Übung fragt die App die Knie-Ampel ab.';

function units() {
  return [
    unit('u-taeglich', 'Täglich: Streckung und Aktivierung',
      ['streckung-sitzend', 'quad-sets', 'gerades-beinheben'],
      'Jeden Tag, auch an Ruhetagen. Volle Streckung und ein gut ansteuerbarer Quadrizeps haben vor der OP die höchste Priorität.'),
    unit('u-druecken', 'Brust, Schultern, Trizeps',
      ['bankdruecken', 'schraegbank-kh', 'schulterdruecken-sitzend', 'dips-maschine', 'seitheben-sitzend', 'trizeps-ueberkopf'],
      'Im Sitzen oder Liegen trainieren.'),
    unit('u-beine-a', 'Beine Prehab A',
      ['einbeinstand-stoerung', 'beinpresse', 'beinpresse-einbeinig', 'gb-beinpresse', 'beinbeuger', 'hip-thrust', 'wadenheben'],
      `Schwerpunkt geschlossene Kette und Hamstrings. ${LEG_HINT}`),
    unit('u-ziehen', 'Rücken, Bizeps, Klimmzüge',
      ['klimmzuege', 'latzug', 'rudern-kabel', 'rudern-maschine', 'face-pulls-sitzend', 'bizepscurls-sitzend', 'hammercurls-sitzend'],
      'Klimmzüge zuerst, solange du frisch bist. Alles andere im Sitzen.'),
    unit('u-core', 'Core und Mobilität',
      ['unterarmstuetz', 'seitstuetz', 'pallof', 'dead-bug', 'cable-crunch', 'fersenrutschen', 'hueftbeuger', 'bws-rotation']),
    unit('u-beine-b', 'Beine Prehab B',
      ['einbeinstand-stoerung', 'wandsitzen', 'kniestrecker', 'gb-kniestrecker', 'rdl', 'step-up', 'abduktoren', 'clamshell'],
      `Schwerpunkt Quadrizeps im Bereich 90 bis 45 Grad, Isometrie und Hüfte. An Schmerztagen Kniestrecker gegen die Halte-Variante oder Spanish Squat tauschen. ${LEG_HINT}`),

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
    do: day('u-core', { title: 'Rad, Core, Mobilität', before: cardio(['rad_indoor'], 45, 60, { zone2: true }) }),
    fr: day('u-beine-b', { before: cardio(['ergometer'], 15, 15, { text: 'locker' }) }),
    sa: day(null, {
      title: 'Lange Ausdauer',
      before: cardio(['rad_indoor', 'schwimmen'], 60, 90, { zone2: true }),
      note: 'Rennrad draußen ist in Ordnung: Klickpedale auf geringe Auslösehärte und mehr Float stellen. Bei Instabilitätsgefühl lieber auf der Rolle.',
    }),
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

const P2_BASE = 'Was erlaubt ist, bestimmt der Operateur. Nach der Achskorrektur sind meist 3 bis 4 Wochen Teilbelastung mit Bodenkontakt üblich, der Bewegungsumfang anfangs 0 bis 90 Grad und Vollbelastung etwa ab Woche 6. Belastung und Bewegungsumfang laut Arztfreigabe eintragen.';

function phases() {
  return [
    {
      id: 'p1', order: 1, group: 'p1', name: 'Phase 1', title: 'Prehab bis zur ersten OP', locked: false, dailyUnitId: 'u-taeglich',
      hint: 'Ziel bis zur OP: volle Streckung, ruhiges Knie ohne Erguss, gut ansteuerbarer Quadrizeps und hohe Grundkraft. Wochen 1 bis 3: Streckung, Aktivierung, Isometrie, leichte Beinpresse, gesundes Bein schwer. Wochen 4 bis 12: Kraftblock, jede Woche steigern. Wochen 13 bis 16: Lasten halten, die Kriterien im Verlauf unter Knie prüfen lassen und Gehen an Krücken mit Teilbelastung üben. Neues Knacken, Einklemmen oder Blockaden vor schwerem Beintraining ärztlich abklären. Oberkörper im Sitzen oder Liegen.',
      weekplan: phase1Week(),
    },
    {
      id: 'p2a', order: 2, group: 'p2', name: 'Phase 2a', title: 'Nach der ersten OP, ab Woche 1 bis 2', locked: false, dailyUnitId: 'u-taeglich',
      hint: `${P2_BASE} In 2a: Oberkörper im Sitzen, Rumpf am Boden, Physio-Übungen, täglich Streckung und Aktivierung. Das gesunde Bein schwer trainieren, wenn der Operateur zustimmt. Elektrostimulation und Okklusionstraining (BFR) mit Physio und Operateur besprechen.`,
      weekplan: phase2aWeek(false),
    },
    {
      id: 'p2b', order: 3, group: 'p2', name: 'Phase 2b', title: 'Ab etwa Woche 4 bis 6 nach Freigabe', locked: true, dailyUnitId: 'u-taeglich',
      hint: `${P2_BASE} In 2b kommt Ergometer ohne Widerstand dazu, 15 bis 20 Minuten.`,
      weekplan: phase2aWeek(true),
    },
    {
      id: 'p2c', order: 4, group: 'p2', name: 'Phase 2c', title: 'Ab Vollbelastung nach Freigabe', locked: true, dailyUnitId: 'u-taeglich',
      hint: `${P2_BASE} In 2c gilt der Wochenplan wie in Phase 1. Prehab A und B schrittweise mit leichten Gewichten beginnen, keine hohen Lasten, solange der Operateur das vorgibt.`,
      weekplan: phase1Week(),
    },
    {
      id: 'p3', order: 5, group: 'p3', name: 'Phase 3', title: 'Zwischen den OPs', locked: false, dailyUnitId: 'u-taeglich',
      hint: 'Das Kreuzband fehlt weiterhin. Kein Laufen, kein Padel. Diese Phase ist die eigentliche Vorbereitung auf die Kreuzband-OP: Quadrizeps- und Hüftkraft nach Freigabe wieder aufbauen, Störungstraining fortsetzen und vor OP 2 die Kriterien im Verlauf unter Knie erfüllen, vor allem Quadrizeps mindestens 80 Prozent der Gegenseite.',
      weekplan: phase1Week(),
    },
    {
      id: 'p4', order: 6, group: 'p4', name: 'Phase 4', title: 'Nach der zweiten OP', locked: false, dailyUnitId: null,
      hint: 'Normale Kreuzband-Reha nach Vorgabe von Operateur und Physio. Laufen frühestens etwa 3 bis 4 Monate nach OP 2, wenn das Knie schmerz- und ergussfrei ist und der Quadrizeps mindestens 70 bis 80 Prozent der Gegenseite erreicht. Padel und Sport mit Richtungswechseln frühestens 9 bis 12 Monate nach OP 2 und nur nach bestandenem Return-to-Sport-Test mit mindestens 90 Prozent.',
      weekplan: emptyWeek(),
    },
  ];
}

/** Frische Kopie der Startdaten. Jeder Aufruf liefert neue Objekte. */
export function buildSeed() {
  return { exercises: exercises(), units: units(), phases: phases() };
}

/**
 * Übernimmt neue Startdaten in einen bestehenden Plan.
 * Startübungen, Starteinheiten und Wochenpläne werden ersetzt. Erhalten bleiben:
 * eigene Übungen und Einheiten (IDs, die nicht aus den Startdaten stammen),
 * Pausierungen nach roter Ampel und freigeschaltete Phasen.
 */
export function mergeSeedUpdate(current, seed = buildSeed()) {
  const seedExIds = new Set(seed.exercises.map((e) => e.id));
  const seedUnitIds = new Set(seed.units.map((u) => u.id));
  const seedPhaseIds = new Set(seed.phases.map((p) => p.id));
  const oldEx = new Map(current.exercises.map((e) => [e.id, e]));
  const oldPhases = new Map(current.phases.map((p) => [p.id, p]));

  const exercisesOut = seed.exercises.map((e) => {
    const old = oldEx.get(e.id);
    if (!old?.paused) return e;
    return { ...e, paused: true, pausedSince: old.pausedSince ?? null, pausedReason: old.pausedReason ?? null };
  });
  exercisesOut.push(...current.exercises.filter((e) => !seedExIds.has(e.id)));

  const unitsOut = [...seed.units, ...current.units.filter((u) => !seedUnitIds.has(u.id))];

  const phasesOut = seed.phases.map((p) => {
    const old = oldPhases.get(p.id);
    return old ? { ...p, locked: p.locked && old.locked } : p;
  });
  phasesOut.push(...current.phases.filter((p) => !seedPhaseIds.has(p.id)));

  return { exercises: exercisesOut, units: unitsOut, phases: phasesOut };
}
