# Empathy Pro 2.0 — Charter prodotto (punti fissi)

Questo documento **fissa** ciò che intendiamo per Empathy Pro 2.0, in continuità con le discussioni di prodotto e con `CONSTITUTION.md`.

---

## 1. Cosa siamo

- **Piattaforma di performance e analisi metabolica** che:
  - acquisisce dati da **device** e da **importazione di esami di laboratorio** (e flussi analoghi);
  - usa **intelligenza artificiale** e **banche dati scientifiche** per **incrociare e analizzare** i dati sotto **molteplici angolazioni**.

## 2. Domini scientifici (viste incrociate)

Analisi e interpretazione strutturata (sempre con **tracciabilità** e **limiti di evidenza**) su:

- Biochimica, fisiologia, istologia (ove rilevante)
- Endocrinologia, neurofisiologia
- Nutrizione, **nutrigenomica**
- Microbiota e **omiche** in senso ampio
- Genetica ed **epigenetica**
- Aspetto **energetico / bioenergetico** (stato di adattamento, efficienza, stress redox, ecc. — come da modello twin/motori)
- **Campi elettromagnetici** e affini: **solo** dove la scienza ha evidenza validata; **nessun superamento** del confine tra evidenza e supposizione in UX, copy e claim

## 3. Focus principale: adattamento

- L’obiettivo centrale dell’app è capire **come il corpo risponde agli stimoli esterni**.
- **L’adattamento è il focus**: non siamo (solo) un altro analizzatore di **dati esterni** (watt, speed, tempo, …) in competizione con il mercato.
- Analizziamo il **dato interno**: come ti stai **adattando**, come il corpo **migliora il rendimento biochimico** e fisiologico nel tempo.

## 4. Come Empathy “lavora” sul metabolismo

- **Supportare e amplificare** le vie metaboliche attraverso:
  - il **giusto stimolo** (training, nutrizione, recovery, …);
  - **integrazione mirata** di **fattori facilitatori** delle reazioni (nutrienti, cofattori, timing, contesto);
  - **incastro nel timing** e nella **situazione metabolica generale**.
- Empathy **guida** e **ottimizza**: ogni processo è un **flusso di dati** **dinamico**; i dati **si adattano** e **influenzano** gli altri (twin, feedback loop, vincoli deterministici).

## 5. Fase 1 — Atleti, coach, abbonamenti

- Pubblico iniziale: **atleti** e **coach**.
- Modello: **abbonamento** (es. Stripe, carta di credito, sottoscrizione).
- **Coach**:
  - accesso **distinto** dall’utente-atleta;
  - può **collegarsi** ai propri atleti o **invitare** atleti sotto la propria guida;
  - può **intervenire** su un dato (correzione, nota, override controllato) **senza rompere** il **modello generativo** (permessi, audit, versioning — da specificare in implementazione).
- **Abbonamento coach**: **separato**; in una direzione prodotto il coach può essere **gratuito** ma con **carta di credito** per **ricompense** legate alla vendita di prodotti Empathy (affiliate / revenue share — dettaglio legale e Stripe Connect da definire con consulenza).

## 6. Prodotti modulari a pagamento

- **Biomeccanica**: prodotto **separato a pagamento** — es. **bike fitting da remoto**.
- **Aerodinamica**: prodotto **separato a pagamento** — analisi con **sensori** e/o **da remoto** tramite **importazione video e immagini** (pipeline dedicate, qualità controllata).

## 7. Health & bio — bioimpedenza

- In **Health & bio** va prevista l’**analisi della bioimpedenza** (BIA):
  - ulteriore segnale per **stato cellulare** e **fase metabolica** della cellula;
  - integrazione con **calcolo di carico interno** e modelli bioenergetici → **potenza di comprensione** superiore rispetto a solo load esterno.

## 8. Fase 2 — Salute (non solo atleta)

- Apertura del sistema verso **salute**: analisi dell’**individuo** anche al di là del frame “atleta”.
- **Nuovi moduli** devono **incastrarsi** nello **stesso schema generativo** (non silos paralleli).

## 9. Multi-disciplina — oltre la potenza

- Le basi di calcolo storiche sono orientate alla **potenza** (es. ciclismo).
- In 2.0 occorrono calcoli e modelli **nativi** per **running**, **sci di fondo**, **nuoto**, ecc., dove il dato principale **non è la potenza**: metriche canoniche per disciplina, armonizzazione verso twin e carico interno.

---

## Collegamento repository GitHub

Se il remote non è ancora configurato, dalla root di questo repo:

```bash
gh auth login
gh repo create empathy-pro-2 --private --source=. --remote=origin --push
```

(Sostituire nome/org se il repo esiste già.) In assenza di `gh`, creare il repository vuoto dalla UI GitHub e poi:

```bash
git remote add origin https://github.com/TUO_ORG/empathy-pro-2.git
git branch -M main
git push -u origin main
```
