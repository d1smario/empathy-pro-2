/**
 * Contenuto privacy allineato a V1 `SettingsPageView` (sezione Privacy e dati).
 * Usato dalla pagina pubblica `/privacy` (es. link Garmin Developer Portal).
 */
export const empathyPrivacySections = [
  {
    title: "Introduzione e natura del sistema",
    body: [
      "EMPATHY PRO e' una piattaforma digitale avanzata progettata per l'analisi fisiologica computazionale, la modellazione metabolica e la costruzione dinamica di un Digital Twin dell'individuo.",
      "A differenza dei tradizionali sistemi di monitoraggio, EMPATHY non si limita alla raccolta e visualizzazione dei dati, ma li integra in un sistema adattivo capace di interpretare lo stato biologico dell'utente e di generare modelli predittivi relativi alla performance, al recupero e all'adattamento fisiologico.",
      "La natura del sistema implica il trattamento di dati altamente sensibili, inclusi dati sanitari, biometrici, comportamentali e dati derivati ad alto valore informativo. Per tale ragione, EMPATHY adotta un framework di governance dei dati strutturato secondo elevati standard normativi e tecnologici.",
    ],
  },
  {
    title: "Titolare del trattamento",
    body: [
      "Il Titolare del trattamento e' Day One Sagl, con sede in Via Nassa 15, 6900 Lugano, Svizzera.",
      "Il Titolare determina le finalita' e i mezzi del trattamento dei dati personali e opera in conformita' alle normative applicabili, inclusi il Regolamento (UE) 2016/679 (GDPR) e la Legge Federale Svizzera sulla Protezione dei Dati (nFADP).",
      "Il Titolare e' responsabile dell'implementazione di misure tecniche e organizzative adeguate per garantire e dimostrare che il trattamento e' effettuato conformemente alla normativa vigente.",
    ],
  },
  {
    title: "Quadro normativo",
    body: [
      "Il trattamento dei dati all'interno della piattaforma EMPATHY avviene nel rispetto di un quadro normativo multilivello che include GDPR, normativa svizzera nFADP, linee guida EDPB, standard ISO/IEC 27001 e ISO/IEC 27701 e principi di protezione dei dati sanitari ispirati al framework HIPAA, ove applicabili.",
      "Questo approccio e' progettato per mantenere elevati livelli di conformita' anche su scala internazionale.",
    ],
  },
  {
    title: "Classificazione e natura dei dati trattati",
    body: [
      "EMPATHY tratta diverse categorie di dati organizzate secondo un modello gerarchico basato sul livello di sensibilita' e rischio.",
      "Tra questi rientrano dati personali identificativi necessari per la gestione dell'account e l'erogazione del servizio; dati biometrici e fisiologici come frequenza cardiaca, HRV, potenza, GPS, sonno; dati sanitari come analisi del sangue, microbiota, dati epigenetici e ormonali; dati bioenergetici derivanti da tecnologie come la bioimpedenza; e dati derivati come profilo metabolico, stato di fatica, capacita' adattativa e Digital Twin.",
      "I dati derivati, pur essendo inferiti, sono considerati altamente sensibili in quanto rappresentano una sintesi avanzata dello stato fisiologico dell'individuo.",
    ],
  },
  {
    title: "Come utilizziamo i dati",
    body: [
      "I dati vengono inizialmente raccolti attraverso dispositivi, input manuali e fonti esterne autorizzate. Successivamente vengono sottoposti a processi di normalizzazione e integrazione per garantire coerenza e qualita'.",
      "Nella fase di elaborazione, i dati sono utilizzati per costruire modelli fisiologici e generare il Digital Twin. I risultati vengono quindi utilizzati per fornire output operativi come programmi di allenamento, strategie nutrizionali e analisi di performance.",
      "I dati possono inoltre essere utilizzati, in forma aggregata e anonimizzata, per attivita' di ricerca scientifica e miglioramento degli algoritmi, nel rispetto dei principi di minimizzazione e protezione dei dati.",
    ],
  },
  {
    title: "Base giuridica del trattamento",
    body: [
      "Il trattamento dei dati personali e sanitari si fonda su una pluralita' di basi giuridiche, tra cui il consenso esplicito dell'interessato, necessario in particolare per il trattamento delle categorie particolari di dati, e l'esecuzione di un contratto rappresentato dall'erogazione dei servizi richiesti dall'utente.",
      "In aggiunta, il trattamento puo' essere giustificato dal legittimo interesse del Titolare per attivita' di miglioramento del sistema, sicurezza e prevenzione delle frodi, sempre nel rispetto dei diritti fondamentali dell'interessato.",
      "Il consenso e' raccolto in modo specifico, informato, libero e revocabile in qualsiasi momento.",
    ],
  },
  {
    title: "Ciclo di vita del dato",
    body: [
      "EMPATHY implementa un modello strutturato di gestione del ciclo di vita del dato che copre tutte le fasi del trattamento.",
      "I dati sono conservati per un periodo limitato e proporzionato alle finalita' del trattamento e sono cancellati o anonimizzati su richiesta dell'interessato o al termine del rapporto.",
      "Tutte le fasi sono tracciate e soggette a controlli e audit.",
    ],
  },
  {
    title: "DPIA, IA e profilazione",
    body: [
      "Considerata la natura sistematica e su larga scala del trattamento di dati sanitari e biometrici, EMPATHY applica una Data Protection Impact Assessment (DPIA) continua per identificare e mitigare i rischi.",
      "La piattaforma utilizza modelli computazionali avanzati per l'analisi dei dati e la generazione di insight, ma non adotta sistemi decisionali completamente automatizzati con effetti legali o significativi per l'utente.",
      "L'intelligenza artificiale e' impiegata come strumento di supporto analitico con approccio human-in-the-loop, per garantire supervisione umana, interpretabilita' e controllo dei bias.",
    ],
  },
  {
    title: "Sicurezza e trasferimenti internazionali",
    body: [
      "EMPATHY adotta misure di sicurezza tecniche e organizzative avanzate, tra cui cifratura dei dati in transito e a riposo, architetture Zero Trust, autenticazione forte, controllo accessi basato su ruoli e attributi e monitoraggio continuo.",
      "I trasferimenti di dati al di fuori dello Spazio Economico Europeo o della Svizzera avvengono nel rispetto delle garanzie previste dalla normativa, inclusi Standard Contractual Clauses e, ove applicabile, decisioni di adeguatezza.",
    ],
  },
  {
    title: "Diritti dell'interessato e proprieta' dei dati",
    body: [
      "Gli utenti hanno il diritto di accedere ai propri dati, richiederne la rettifica o la cancellazione, limitare il trattamento, opporsi allo stesso e ottenere la portabilita' dei dati.",
      "L'utente mantiene la piena proprieta' dei propri dati personali. Il Digital Twin rappresenta un modello computazionale derivato, utilizzato esclusivamente per l'erogazione del servizio e per finalita' di ricerca in forma anonimizzata.",
      "Il sistema non prevede la vendita o la cessione a terzi dei dati personali in forma identificabile.",
    ],
  },
  {
    title: "Limitazione di responsabilita' ed etica",
    body: [
      "EMPATHY PRO non e' un dispositivo medico e non fornisce diagnosi cliniche. Le informazioni fornite hanno finalita' informative e di supporto alla performance.",
      "L'utente rimane responsabile delle decisioni relative alla propria salute.",
      "Il sistema e' sviluppato secondo principi di trasparenza, equita' e protezione della persona, con particolare attenzione alla prevenzione di utilizzi impropri o discriminatori dei dati.",
    ],
  },
] as const;

export const empathyPrivacyUserRights = [
  "Accesso ai dati",
  "Rettifica",
  "Cancellazione",
  "Limitazione del trattamento",
  "Opposizione",
  "Portabilita' dei dati",
  "Revoca del consenso",
] as const;
