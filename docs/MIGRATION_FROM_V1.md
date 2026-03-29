# Migrazione da Empathy V1 (`nextjs-empathy-pro`)

Repo V1 (sibling): cartella `nextjs-empathy-pro` accanto a questo repository.

## Strategia

Preferire **strangler** / cutover per dominio (reality, knowledge, twin, …) piuttosto che big-bang unico, salvo decisione esplicita.

## Da fare quando si inizia il codice

1. Esportare **contratti** da `api/*/contracts.ts` e `lib/empathy/schemas` come specifica.
2. Mappare **tabelle Supabase** V1 → modello eventi / snapshot 2.0 (tabella per tabella).
3. Pianificare **import** atleti/coach e **stato abbonamento** Stripe in parallelo o unificato.

*Stub — aggiornare con date e owner.*
