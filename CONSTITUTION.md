# EMPATHY Pro 2.0 — Constitution

Documento **vincolante** per chi sviluppa su questo repository. Integra invarianti architetturali e principi di prodotto descritti in `docs/PRODUCT_VISION.md`.

## A. Scopo della piattaforma

- Piattaforma di **performance e analisi metabolica** con focus su **come il corpo risponde agli stimoli** e sull’**adattamento** (non solo su output esterni tipo watt/velocità/tempo come unico racconto).
- Acquisizione dati da **device** e da **importazione esami di laboratorio** (e analoghi flussi clinici dove previsti).
- Uso di **intelligenza artificiale** e **banche dati scientifiche** per **incrociare e interpretare** i dati sotto molteplici viste (vedi dominio §B), **entro i limiti di evidenza validata** — niente claim oltre letteratura/consenso scientifico, niente “medicina inventata”.

## B. Domini di analisi (ambito scientifico)

Il sistema deve poter modellare, collegare e spiegare (a livello di prodotto) incroci tra:

- Biochimica, fisiologia, istologia (dove applicabile al contesto atleta/salute)
- Endocrinologia, neurofisiologia
- Nutrizione, nutrigenomica, microbiota
- Omiche in generale, genetica ed epigenetica
- Aspetti **energetici / bioenergetici** dello stato cellulare e dell’adattamento
- **Campi elettromagnetici** e affini: **solo** dove esiste letteratura validata e con confini espliciti in UI e documentazione (nessuna estensione speculativa presentata come certezza)

## C. Principio operativo (metabolic flow)

- **Guidare e ottimizzare** processi come **flussi di dati dinamici** che si influenzano a vicenda.
- **Supportare e amplificare vie metaboliche** con: stimolo appropriato, **integrazione mirata** di cofattori/facilitatori, **timing** e contesto della situazione metabolica globale.
- I **motori numerici deterministici** non sono sostituiti da LLM; l’AI interpreta, orchestra, recupera evidenza, propone — come da policy tecnica §F.

## D. Fasi di mercato (high level)

- **Fase 1:** atleti e coach; abbonamenti; coach con ruolo e permessi distinti; intervento coach sui dati senza rompere il modello generativo (vedi `docs/COMMERCIAL_AND_ROLES.md`).
- **Fase 2:** estensione verso **salute** (individuo non solo atleta) con moduli aggiuntivi incastrati nello **stesso schema generativo**.

## E. Metriche e discipline

- Le basi di calcolo attuali in V1 sono orientate alla **potenza** (ciclismo-centric); in 2.0 il modello deve supportare **nativemente** discipline dove la potenza non è la metrica primaria (**running, sci di fondo, nuoto**, ecc.) con **metriche canoniche per disciplina** e traduzione verso il twin/carico interno.

## F. Invarianti tecnici (da V1, non negoziabili)

1. Loop: `reality → physiology → bioenergetics → twin → azioni → esecuzione → dato reale → confronto → adattamento → aggiornamento`.
2. Priorità: `Reality > Plan`, `Physiology > UI`, `Internal load > external`.
3. **Un solo** generatore canonico di **singola sessione** (builder-equivalente); calendario = operativo; planner orchestration ≠ secondo motore sessione.
4. AI: interpretazione, evidenza, orchestrazione — **mai** sostituto esclusivo dei motori o del twin.
5. Moduli prodotto (estensibili in Fase 2): dashboard, profile, physiology, training, nutrition, health, biomechanics, aerodynamics, athletes, settings — coerenti con registry concettuale.

## G. Health & bio — bioimpedenza

La **bioimpedenza** è prevista come ingresso strutturato per **stato cellulare / fase metabolica**, integrata con **carico interno** e bioenergetica — vedi `docs/COMMERCIAL_AND_ROLES.md`.

## H. Integrazioni esterne (LogMeal, Spline, token Figma)

- Devono restare ai **confini** (ingest, presentazione, asset): **non** sostituiscono motori, twin o builder.
- In caso di errore o indisponibilità: **degradazione controllata** (fallback UI, inserimento manuale), **senza** redirect globali né rottura auth — vedi `docs/ARCHITECTURE_SAFETY_AND_RISKS.md`.

---

*Versione 1.1 — allineata al charter in `docs/PRODUCT_VISION.md`.*
