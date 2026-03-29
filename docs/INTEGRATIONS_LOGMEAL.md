# Integrazione LogMeal — diario alimentare con AI (solo Empathy Pro 2.0)

**Ambito:** implementazione **unicamente** in questo repository (`empathy-pro-2`), non in Empathy V1.

**Fornitore:** [LogMeal — Food AI, riconoscimento alimentare e analisi nutrizionale](https://logmeal.com/it/).

## Ruolo in Empathy

- **Ingest di reality nutrizionale**: foto pasto → API LogMeal → payload strutturato (piatti / alimenti / stime nutrizionali secondo il contratto ufficiale).
- Rispetta **`Reality > Plan`**: non sostituisce i motori deterministici; alimenta `domain-nutrition`, pathway/timing e il **digital twin** con **confidenza** e **qualità** esplicite.

## Verità alimentare → sistema dinamico

1. **Ipotesi da visione AI** con score di confidenza e metadati (orario, contesto allenamento).
2. **Correzione atleta o coach** (con permessi) = **verità operativa**.
3. **Ricalcolo deterministico** dopo correzione o merge con catalogo alimenti canonico → propagazione verso twin e moduli collegati.
4. **Audit**: `proposta AI → correzione → payload finale`.

## Implementazione nel monorepo

- Pacchetto **`packages/integrations-logmeal`**: client HTTP, mapping → `@empathy/contracts`.
- Chiamate **solo server-side** (`apps/web` route handlers o `apps/api` se presente).
- Variabili: vedi `.env.example` nella root di questo repo (`LOGMEAL_*`).

## Compliance

Consenso per invio immagini a terze parti, DPA con LogMeal, nessun claim oltre evidenza e confini prodotto.
