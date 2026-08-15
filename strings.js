// =============================================================================
// strings.js — ALLE Texte der App an einer Stelle.
//
// Willst du die Sprache wechseln, ist das die einzige Datei, die du anfasst.
// Die Schlüssel der Symptome (dyschezia, dysuria …) bleiben dagegen englisch
// und unverändert: sie stehen so in der Datenbank und in jedem Backup. Wer sie
// umbenennt, macht alte Sicherungen unlesbar.
// =============================================================================

export const T = {
  appName: 'Zyklus',

  tabs: { calendar: 'Kalender', stats: 'Statistik', export: 'Export' },

  // -- Wochentage und Monate, Montag zuerst -----------------------------------
  weekdayInitials: ['M', 'D', 'M', 'D', 'F', 'S', 'S'],
  weekdays: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
  months: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
           'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  monthsShort: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
                'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],

  // -- Skalen -----------------------------------------------------------------
  pain: ['Keine', 'Leicht', 'Mittel', 'Stark'],
  flow: ['Keine', 'Schmierblutung', 'Normal', 'Stark'],

  // -- Symptome ---------------------------------------------------------------
  // key: interner, unveränderlicher Schlüssel. label: was sie sieht.
  // csv: Spaltenname in der Tabelle für die Ärztin.
  symptoms: [
    { key: 'dyschezia',      label: 'Schmerzen beim Stuhlgang',      csv: 'schmerz_stuhlgang' },
    { key: 'dysuria',        label: 'Schmerzen beim Wasserlassen',   csv: 'schmerz_wasserlassen' },
    { key: 'blood_stool',    label: 'Blut im Stuhl oder Urin',       csv: 'blut_stuhl_urin' },
    { key: 'bloating',       label: 'Blähbauch',                     csv: 'blaehbauch' },
    { key: 'nausea',         label: 'Übelkeit oder Erbrechen',       csv: 'uebelkeit' },
    { key: 'fatigue',        label: 'Starke Erschöpfung',            csv: 'erschoepfung' },
    { key: 'back_pain',      label: 'Rückenschmerzen',               csv: 'rueckenschmerzen' },
    { key: 'leg_pain',       label: 'Beinschmerzen',                 csv: 'beinschmerzen' },
    { key: 'shoulder_pain',  label: 'Schulterschmerzen',             csv: 'schulterschmerzen' },
    { key: 'headache',       label: 'Kopfschmerzen',                 csv: 'kopfschmerzen' },
    { key: 'diarrhea',       label: 'Durchfall',                     csv: 'durchfall' },
    { key: 'constipation',   label: 'Verstopfung',                   csv: 'verstopfung' },
    { key: 'dyspareunia',    label: 'Schmerzen beim oder nach dem Sex', csv: 'schmerz_sex' },
    { key: 'poor_sleep',     label: 'Schlechter Schlaf',             csv: 'schlechter_schlaf' },
  ],

  // -- Kalender ---------------------------------------------------------------
  cal: {
    prevMonth: 'Vorheriger Monat',
    nextMonth: 'Nächster Monat',
    today: 'Heute eintragen',
    notLogged: 'Nicht erfasst',
    noPeriodTitle: 'Noch keine Periode erfasst',
    noPeriodNote: 'Tippe auf einen Tag und trage die Blutung ein, damit die Zyklen gezählt werden können.',
    cycleDay: (n) => `Tag ${n} des Zyklus`,
    start: 'Beginn',
    predicted: 'Nächste Periode geschätzt',
    inDays: (n) => (n > 0 ? `In ${n} Tagen.` : n === 0 ? 'Heute erwartet.' : `Seit ${-n} Tagen überfällig.`),
    predNote: 'Geschätzt aus dem Median der letzten Zyklen. Das ist keine medizinische Vorhersage.',
    needThree: 'Für eine Schätzung braucht es mindestens drei vollständige Zyklen.',
    ariaPain: (p) => `Schmerz ${p} von 10`,
    ariaFlow: (f) => `Blutung ${f.toLowerCase()}`,
    ariaNotLogged: 'nicht erfasst',
  },

  // -- Tageseditor ------------------------------------------------------------
  ed: {
    cancel: 'Abbrechen',
    save: 'Sichern',
    painTitle: 'Stärkster Schmerz der letzten 24 Stunden',
    precise: 'Genauer Wert von 0 bis 10',
    painWord: 'Schmerz',
    painNote: 'Trage die Spitze des Tages ein, nicht den Durchschnitt. Auch Tage ohne Schmerzen gehören erfasst: ein leerer Tag heißt «nicht erfasst», nicht «null».',
    flowTitle: 'Periode',
    flowNote: '«Schmierblutung» sind wenige Tropfen, für die eine Slipeinlage reicht. «Normal» und «Stark» gelten, sobald Binde oder Tampon nötig sind. Diese Unterscheidung braucht die Zyklusberechnung.',
    symptoms: 'Weitere Symptome',
    symptomsN: (n) => `Weitere Symptome (${n})`,
    symptomsNote: 'Diese Liste folgt den Leitsymptomen der ESHRE-Leitlinie 2022 zur Endometriose, ergänzt um die Darm- und Blasenfragen des WERF-EPHect-Fragebogens.',
    analgTitle: 'Schmerzmittel',
    analgCheck: 'Ich habe ein Schmerzmittel genommen',
    analgPlaceholder: 'Welches und wie oft',
    analgNote: 'Bitte immer eintragen: ein niedriger Schmerzwert mit Schmerzmittel ist etwas anderes als ein niedriger Wert ohne.',
    notes: 'Notizen',
    notesPlaceholder: 'Optional',
    deleteDay: 'Eintrag dieses Tages löschen',
    confirmDelete: 'Eintrag dieses Tages wirklich löschen?',
  },

  // -- Statistik --------------------------------------------------------------
  st: {
    title: 'Statistik',
    empty: 'Noch keine Daten. Trage ein paar Tage im Kalender ein. Die Zyklusstatistik erscheint ab dem zweiten Periodenbeginn.',

    coverage: 'Datenabdeckung',
    daysLogged: 'Erfasste Tage',
    coveragePct: 'Abdeckung des Zeitraums',
    coverageNote: 'Unter 80 % Abdeckung werden die Schmerzmittelwerte wacklig: nicht erfasste Tage fließen gar nicht ein, sie zählen nicht als null.',

    cycles: 'Zyklen',
    completeCycles: 'Vollständige Zyklen',
    meanLength: 'Mittlere Länge',
    sd: 'Standardabweichung',
    minMax: 'Minimum – Maximum',
    regularity: 'Regelmäßigkeit',
    regular: (v) => `Regelmäßig (Schwankung ${v} Tage)`,
    regularYoung: (v) => `Regelmäßig unter 26 Jahren (Schwankung ${v} Tage)`,
    irregular: (v) => `Unregelmäßig (Schwankung ${v} Tage)`,
    noCycleYet: 'Ein Zyklus schließt sich erst, wenn die nächste Periode beginnt. Für die erste Länge braucht es also einen zweiten Beginn.',
    fewCycles: 'Mit weniger als drei Zyklen sagt der Mittelwert wenig aus. Nach etwa einem halben Jahr wird das Bild lesbar.',

    cycleChart: 'Länge jedes Zyklus',
    tapBar: 'Tippe auf einen Balken für die Details.',
    bandNote: 'Die beiden gestrichelten Linien sind der Normalbereich nach FIGO, 24 bis 38 Tage. Zyklen außerhalb sind rot und tragen ihre Zahl.',
    seeNumbers: 'Zahlen anzeigen',
    tblStart: 'Beginn',
    tblDays: 'Tage',
    tblClass: 'Einstufung',
    axisCycles: 'Zyklen in zeitlicher Reihenfolge',
    axisDays: 'Tage',
    cycleReadout: (i, d, n, c) => `Zyklus ${i} · Beginn ${d} · ${n} Tage · ${c}`,

    menses: 'Dauer der Blutung',
    meanDuration: 'Mittlere Dauer',
    prolonged: 'Blutungen über 8 Tage',
    prolongedNote: 'FIGO gilt eine Blutung ab mehr als 8 aufeinanderfolgenden Tagen als verlängert. Das lohnt sich, bei der Ärztin anzusprechen.',

    painTitle: 'Schmerz',
    meanDuring: 'Mittelwert während der Periode',
    meanOutside: 'Mittelwert außerhalb der Periode',
    pctOutside: 'Tage außerhalb der Periode mit Schmerz ≥ 4',
    ofDays: (pct, n) => `${pct} % von ${n}`,
    worstDay: 'Schlimmster Tag',
    analgDays: 'Tage mit Schmerzmittel',
    painNote: 'Beckenschmerz, der nicht an die Periode gebunden ist, unterscheidet die Endometriose am deutlichsten von einer gewöhnlichen Dysmenorrhoe. Das ist die Zahl für den Arzttermin.',

    profile: 'Schmerz über den Zyklus',
    tapChart: 'Tippe auf das Diagramm, um einen Tag abzulesen.',
    profileNote: 'Die Null ist der erste Tag der Periode, negative Werte sind die Tage davor. Bleibt die Kurve auch weit weg von der Null hoch, ist der Schmerz nicht nur menstruell.',
    axisProfile: 'Tage seit Beginn der Periode',
    onset: 'Beginn',
    profileReadout: (o, v, n) => `Tag ${o >= 0 ? '+' : ''}${o}: mittlerer Schmerz ${v} aus ${n} ${n === 1 ? 'Zyklus' : 'Zyklen'}`,
    profileNoData: (o) => `Tag ${o >= 0 ? '+' : ''}${o}: keine Daten`,
    tblDay: 'Tag',
    tblMeanPain: 'Mittlerer Schmerz',
    tblCycles: 'Zyklen',

    symptomsTitle: 'Symptome',
    noSymptoms: 'Bisher keine Symptome erfasst.',
    symptomSplit: (a, b) => `Periode ${a} % · außerhalb ${b} %`,
    symptomDelta: (sign, v) => `Schmerz ${sign}${v}`,
    symptomNote: '«Schmerz +x» ist der Unterschied im mittleren Schmerz zwischen Tagen mit und ohne dieses Symptom. Das beschreibt die erfassten Daten, es ist kein Ursache-Wirkung-Zusammenhang: bei wenigen Zyklen schwanken diese Zahlen stark.',

    spotting: 'Zwischenblutung',
    oneDay: '1 Tag',
    nDays: (n) => `${n} Tage`,
    spottingNote: 'Episoden mit nur leichten Blutungen außerhalb der Periode. Sie zählen nicht als Zyklusbeginn, sind aber ein eigener klinischer Befund.',
  },

  // -- Frequenzklassen (FIGO) -------------------------------------------------
  freq: { frequente: 'häufig', normale: 'normal', infrequente: 'selten' },

  // -- Export -----------------------------------------------------------------
  ex: {
    title: 'Exportieren und sichern',
    banner: 'Die Daten liegen nur auf diesem Telefon. Sonst nirgends. Sichere das Backup einmal im Monat und schick es dir irgendwohin — es ist die einzige Kopie.',
    content: 'Inhalt',
    from: 'Von',
    to: 'Bis',
    backup: 'Vollständiges Backup',
    backupNote: 'Eine JSON-Datei mit allem. Damit stellst du die Daten auf einem anderen Telefon wieder her, oder falls die App vom Home-Bildschirm verschwindet.',
    btnBackup: 'Backup sichern oder teilen',
    btnRestore: 'Aus einem Backup wiederherstellen',
    doctor: 'Für die Frauenärztin',
    doctorNote: 'Lesbare Zusammenfassung: Zyklusdauer, Dauer der Blutung, Schmerz innerhalb und außerhalb der Periode, Häufigkeit der Symptome.',
    btnSummary: 'Zusammenfassung für den Termin',
    btnCsv: 'CSV-Tabelle (Numbers, Excel)',
    storage: 'Speicher und Installation',
    standalone: 'Vom Home-Bildschirm geöffnet',
    yes: 'Ja',
    noSeeBelow: 'Nein — siehe unten',
    persisted: 'Speicher geschützt',
    notGranted: 'Nicht gewährt',
    used: 'Belegter Platz',
    addToHome: 'Öffne sie in Safari, tippe auf Teilen und dann auf «Zum Home-Bildschirm». Erst dann hört iOS auf, die Daten nach längerer Nichtnutzung zu löschen.',
    btnSample: 'Beispieldaten laden',
    btnWipe: 'Alle Daten löschen',
    confirmSample: 'Vier Zyklen mit erfundenen Daten hinzufügen, um die Statistik auszuprobieren?',
    confirmWipe1: 'Wirklich ALLE Daten löschen? Das lässt sich nicht rückgängig machen. Mach vorher ein Backup.',
    confirmWipe2: 'Ganz sicher? Alle erfassten Tage gehen verloren.',
    confirmImport: (n) => `${n} Tage importieren? Tage mit gleichem Datum werden ersetzt.`,
    importDone: 'Backup wiederhergestellt.',
    importFailed: (m) => 'Die Datei konnte nicht gelesen werden: ' + m,
    badFormat: 'unbekanntes Format',
  },

  // -- Zusammenfassung für die Ärztin -----------------------------------------
  sum: {
    title: 'ZYKLUS- UND SCHMERZTAGEBUCH',
    period: (a, b) => `Zeitraum: ${a} – ${b}`,
    daysLogged: (n) => `Erfasste Tage: ${n}`,
    coverage: (c) => ` (Abdeckung ${c} %)`,
    cycles: 'ZYKLEN',
    completeCycles: (n) => `Vollständige Zyklen: ${n}`,
    mean: (v) => `Mittlere Länge: ${v} Tage`,
    sd: (v) => `Standardabweichung: ${v} Tage`,
    minmax: (a, b) => `Minimum-Maximum: ${a}-${b} Tage`,
    regularity: (v) => `Regelmäßigkeit: ${v}`,
    single: 'Einzelne Zyklen: ',
    menses: 'BLUTUNG',
    prolonged: (n) => `Episoden über 8 Tage: ${n}`,
    spotting: (n) => `Zwischenblutungen: ${n}`,
    pain: 'SCHMERZ (Skala 0-10, stärkster Wert der letzten 24 Stunden)',
    during: (v) => `Mittelwert während der Periode: ${v}`,
    outside: (v) => `Mittelwert außerhalb der Periode: ${v}`,
    pctOutside: (p, n) => `Tage außerhalb der Periode mit Schmerz >= 4: ${p} % von ${n} Tagen`,
    worst: (d, p) => `Schlimmster Tag: ${d}, ${p}/10`,
    analg: (n) => `Tage mit Schmerzmittel: ${n}`,
    symptoms: 'SYMPTOME (Anteil der erfassten Tage)',
    symptomLine: (a, b) => ` (Periode ${a} %, außerhalb ${b} %)`,
    profile: 'MITTLERER SCHMERZ NACH ZYKLUSTAG',
    profileHead: '(0 = erster Tag der Periode)',
    defs: 'Definitionen: Zykluslänge = vom ersten Tag der Periode bis zum ersten Tag der nächsten (FIGO). '
      + 'Dauer der Blutung = aufeinanderfolgende Blutungstage, Schmierblutung eingeschlossen. '
      + 'Ein einzelner blutungsfreier Tag unterbricht die Episode nicht, zwei schon.',
  },

  // -- CSV --------------------------------------------------------------------
  csv: {
    date: 'datum',
    painNrs: 'schmerz_nrs',
    painBand: 'schmerz_stufe',
    flow: 'blutung',
    isMenses: 'periodentag',
    cycleDay: 'zyklustag',
    analgesic: 'schmerzmittel',
    analgesicNote: 'schmerzmittel_notiz',
    note: 'notiz',
  },
};
