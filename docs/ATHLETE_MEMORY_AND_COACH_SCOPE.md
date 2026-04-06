# Memoria atleta, coach e unica linea di verità

Documento **vincolante** per Pro 2.0. Incrocia `CONSTITUTION.md`, `docs/ARCHITECTURE.md`, `docs/COMMERCIAL_AND_ROLES.md` e `.cursor/rules/empathy_athlete_memory.mdc`.

## 1. Scopo

Garantire **una sola linea di generazione dati per individuo**: niente fork di stato tra moduli, niente “memoria training” vs “memoria nutrition” disallineate. La scalabilità è **partizione per atleta** (`athlete_id`), non moltiplicazione di fonti di verità per lo stesso atleta.

## 2. Chiave canonica

- **`athlete_id`** (ID cliente / soggetto): identificatore stabile del **soggetto** di cui il sistema modella twin, preferenze, storico operativo e tracce strutturate.
- Ogni fatto di dominio persistente è **ambito** `athlete_id` (ove applicabile). Eccezioni documentate esplicitamente (es. corpus globale knowledge non legato a un solo atleta).

## 3. Coach vs atleta singolo

- Il **coach non possiede una copia separata** dei dati fisiologici/twin dell’atleta: possiede **diritti di accesso** tramite **membership** (org / rapporto coach–atleta).
- **Cliente senza coach**: stesso modello; ruolo “self”; stesso `athlete_id`.
- Interventi coach (correzioni, note, override controllati): **audit** e permessi come da `docs/COMMERCIAL_AND_ROLES.md`; le modifiche **confluiscono** nella memoria canonica dell’atleta, non in un silo parallelo.

## 4. Scrittura (ferrea)

- I moduli UI **non** scrivono direttamente su tabelle twin / stato core.
- Le scritture passano da **use case di confine** esposti da `packages/domain-*` e `packages/integrations-*` (append eventi, merge fatti strutturati, aggiornamento proiezioni dopo motori, correzioni coach validate).
- **AI / LLM**: solo **payload strutturati validati** (schema) in ingresso alla stessa pipeline; niente testo libero come sorgente numerica per motori o twin.

## 5. Lettura

- Training, nutrition, health, physiology (UI), dashboard, builder, calendar consumano **snapshot / proiezioni / eventi** coerenti con la pipeline, sempre filtrati per **`athlete_id`** e autorizzazione.
- **Calendar** = hub **operativo** (pianificato/eseguito); **non** è fonte biologica primaria. **Builder** = unico generatore canonico di **singola sessione**; legge stato/twin da memoria canonica (vedi `CONSTITUTION.md` §F).

## 6. Sicurezza e accesso dati

- Query e RLS (es. Supabase) devono risolvere: *questo account può agire su questo `athlete_id`?*
- Nessun bypass ingest/twin da route handler “comodi” senza stesso controllo.

## 7. Matrice concettuale (chi scrive cosa)

| Origine | Cosa può scrivere | Note |
|--------|-------------------|------|
| Ingest (device, lab, file) | Eventi normalizzati, allegati qualità | Solo tramite adapter + schema |
| Motori (compute) | Aggiornamenti twin / proiezioni versionate | Dopo input validati |
| AI (interpretation) | Fatti strutturati, trace, binding | Validazione ai confini |
| Coach (con permesso) | Correzioni, override documentati | Audit obbligatorio |
| Atleta (self) | Input reality, preferenze profilo | Stessi gate di validazione |

## 8. Anti-pattern vietati

- Secondo store “di modulo” per lo stesso `athlete_id` che duplica twin o piani senza sincronizzazione formale.
- Generazione sessione/piano da stato solo React o solo locale senza leggere memoria canonica.
- Redirect globali o rottura auth legati a errori di dominio o integrazione.

---

*Versione 1.0 — allineata alla struttura piattaforma Pro 2.0.*
