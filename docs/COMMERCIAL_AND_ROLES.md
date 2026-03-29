# Commerciale, ruoli e SKU (Empathy Pro 2.0)

Complemento operativo a `PRODUCT_VISION.md` e `CONSTITUTION.md`.

## Abbonamenti (Stripe)

- Pagamenti con **carta** e **sottoscrizione** ricorrente per il piano atleta (e varianti).
- **Webhook** Stripe per stato abbonamento, cancellazione, retry — da implementare in `integrations` dedicato, mai logica business nelle route UI.
- Separazione netta: **prezzo**, **product id**, **customer portal** vs dominio twin/fisiologia.

## Ruoli

| Ruolo | Accesso | Note |
|--------|---------|------|
| **Atleta** | Dati propri, piani, consigli, storico | Consumer principale Fase 1 |
| **Coach** | Atleti collegati / invitati | Permessi granulari (lettura, commento, correzione campo X) |
| **Admin / support** | (opzionale) | Solo se necessario operativamente |

## Intervento coach senza rompere il generativo

- Ogni modifica coach su dato “canonico” deve essere:
  - **tracciata** (chi, quando, cosa);
  - **versionata** o **overlay** rispetto al dato derivato da device/motori;
  - **policy**: cosa può overrideare il coach vs cosa resta solo lettura (es. FTP da test lab vs FTP stimato).

## Coach: piano gratuito + carta + ricompense

- Prodotto: abbonamento coach **separato**, possibilmente **gratuito** per accesso base.
- **Carta di credito** richiesta per **payout / ricompense** se il coach vende prodotti Empathy (Stripe Connect o analogo — **validazione legale e fiscale obbligatoria** prima del lancio).

## SKU aggiuntivi

1. **Biomeccanica** — abbonamento o acquisto una tantum; bike fitting remoto; code e consensi separati.
2. **Aerodinamica** — idem; sensori + pipeline **media** (video/immagini) con privacy e retention policy.

## Health & bio — bioimpedenza

- Ingresso dati BIA strutturato (formato provider o import manuale).
- Collegamento a: twin, bioenergetica, idratazione / massa magra-magra, **proxy fase metabolica** dove supportato da letteratura.
- Non sostituisce diagnosi clinica; copy e disclaimer in app.
