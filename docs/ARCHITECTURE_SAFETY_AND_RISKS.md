# Architettura 2.0 — verifica rischi, regole di generazione e anti-crash

Documento di **allineamento** tra `CONSTITUTION.md`, `docs/ARCHITECTURE.md`, `.cursor/rules/empathy_*.mdc` e integrazioni **Figma / Spline / LogMeal**.

## 1. Regole di generazione (coerenza)

| Regola | Rischio se violata | Mitigazione in 2.0 |
|--------|--------------------|--------------------|
| `Reality > Plan` | Piani e UI che ignorano ingest reale (LogMeal, device, lab) | LogMeal → solo **reality** con confidenza; correzione utente = verità prima dei pathway. |
| Un solo **builder** sessione | Due generatori → dati incoerenti, crash logici | Nessun secondo motore “sessione” in integrazioni. |
| AI ≠ motore fisiologico | Claim o numeri “inventati” da LLM | LogMeal/Spline **non** calcolano twin; solo ingest o presentazione. |
| Twin unico | Moduli che divergono | Aggiornamenti twin solo da pipeline compute dopo ingest validato. |

**Conclusione:** con LogMeal e Spline posizionati ai **confini** (ingest e UI), **non** nel cuore dei motori, la struttura resta **funzionale** e coerente con la costituzione.

## 2. Integrazioni — punti critici e mitigazione

### LogMeal

- **Rischio**: timeout API, rate limit, payload inatteso → eccezioni non gestite.
- **Mitigazione**: chiamate solo **server-side**; `try/catch`; risposta degradata (“non disponibile, inserimento manuale”); **mai** lanciare errore non gestito verso il client su flussi core; **non** importare client LogMeal in layout root.

### Spline / WebGL

- **Rischio**: WebGL assente, scena pesante, script third-party → blank o freeze.
- **Mitigazione**: **lazy load** del viewer; **fallback** immagine/video/statico; disabilitare 3D su preferenza accessibilità o dispositivi noti problematici; non bloccare il resto della pagina se il canvas fallisce.

### Figma (token)

- **Rischio**: token mancanti in CI → build fallita (comportamento **desiderabile** rispetto a UI silenziosamente rotta).
- **Mitigazione**: script `tokens:sync` documentato; fallback minimo solo per sviluppo locale se accettato dal team.

### Supabase / Vercel

- **Rischio**: env mancanti in preview → runtime error all’avvio.
- **Mitigazione**: validazione env in startup server (messaggio chiaro); variabili obbligatorie documentate in `.env.example`.

## 3. “Crash” e rotture — cosa evitare

- **Non** accoppiare auth, routing o risoluzione atleta/coach a risposte LogMeal o caricamento Spline.
- **Non** mettere segreti LogMeal in `NEXT_PUBLIC_*`.
- **Non** fare redirect globali da errori di integrazione (solo fallback in-modulo).
- **Non** mutare schema twin da risposte non validate (validazione Zod/schema ai confini).

## 4. Checklist prima di ogni release con nuove integrazioni

- [ ] Percorso felice + percorso errore (API down) testati manualmente o automaticamente.
- [ ] Build produzione senza dipendenze opzionali mancanti che rompono `next build`.
- [ ] Lighthouse / accessibilità su pagine con viewer 3D (fallback utilizzabile).

---

*Aggiornare quando si aggiungono integrazioni o si cambia il piano dati.*
