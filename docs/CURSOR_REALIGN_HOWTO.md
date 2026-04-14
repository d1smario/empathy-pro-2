# Come usare il riallineamento Cursor — EMPATHY Pro

Questa pagina spiega **dove** e **come** applicare i blocchi di testo dei file `CURSOR_REALIGN_*.md`, in relazione a **User rules**, **chat** e **workspace multi-root**.

**Frase di apertura consigliata in chat:** **`RIALLINEAMENTO EMPATHY PRO`** + incolla il blocco da `CURSOR_REALIGN_DAILY.md` o `CURSOR_REALIGN_DEEP.md`.  
(Se serve disambiguare dal rumore di altri progetti, puoi aggiungere in coda: *— clone V1* o *— clone Pro 2*.)

---

## Tre file

| File | Ruolo |
|------|--------|
| `docs/CURSOR_REALIGN_DAILY.md` | Blocco **breve** — ogni giorno o task piccolo |
| `docs/CURSOR_REALIGN_DEEP.md` | Blocco **lungo** — sessione fuori rotta / tunneling |
| `docs/CURSOR_REALIGN_HOWTO.md` | **Questa guida** (meccanica Cursor, non bussola prodotto) |

**Mirror tra repo:** gli stessi tre file vivono in **`nextjs-empathy-pro`** (V1) e in **`empathy-pro-2-cursor`** (Pro 2). Se aggiorni la bussola, allinea **entrambe** le copie nello stesso “intento” (anche se i commit sono separati).

---

## Builder e calendario (chiarimento veloce)

In EMPATHY **non** è un difetto di architettura che il calendario non “sia il builder”.

- Il **builder** **genera** la sessione (contratto + numeri da motori/twin).
- Il **calendario** **registra e distribuisce** il pianificato e l’eseguito.

Il problema grave da evitare è un altro: **perdita di allineamento** — cioè sessioni in calendario **senza** contratto builder serializzato dove il prodotto si aspetta `BUILDER_SESSION_JSON::`, o **percorsi paralleli** che scrivono il calendario aggirando il builder. In quel caso il sistema non funziona “come pensato”; la correzione è riallineare **persistenza e lettura** al contratto canonico, non fondere calendario e builder in un unico motore.

Riferimenti V1: `ARCHITECTURE_RULES.md` § 6.1 e § 6.1.1; `app/api/training/calendar/route.ts`; `lib/training/builder/session-contract.ts`.

**Eccezione frequente:** righe `planned_workouts` create da **seed SQL** in `nextjs-empathy-pro/supabase/` (prefissi `DEMO_`, `PASTE_DEMO_*`, testi tipo `[DEMO_*]` o `mario-rova-demo`) sono pensate per **volume dati / grafici**, non per simulare un flusso Builder→Virya. Non portano `BUILDER_SESSION_JSON::` di proposito.

---

## 1. User rules (Cursor → Settings → Rules)

1. Apri **Cursor → Settings → Rules → User rules** (testo libero, globale sul profilo).
2. Incolla il blocco racchiuso dai triple-backtick da **`CURSOR_REALIGN_DAILY.md`** così resta **sempre** attivo su tutti i progetti e workspace.
3. **Opzionale:** aggiungi in coda il blocco da **`CURSOR_REALIGN_DEEP.md`** solo se vuoi una rule “max” permanente (aumenta rumore e token). Di solito è meglio tenere il DEEP **solo per chat** quando serve.

Le User rules **non** sostituiscono le **Project rules** (`.cursor/rules/*.mdc` nel repo): convivono. Il riallineamento DAILY/DEEP è una bussola trasversale; le rule del repo restano vincolanti su architettura e stabilità.

---

## 2. Chat (senza toccare Settings)

- **Mattina / task breve:** scrivi *RIALLINEAMENTO EMPATHY PRO* e incolla il blocco da `CURSOR_REALIGN_DAILY.md`.
- **Sessione degenerata** (repo sbagliato, SQL a caso, confusione builder/calendario, UI Pro 2 modificata nel clone sbagliato): incolla il blocco da `CURSOR_REALIGN_DEEP.md` e chiedi esplicitamente di **riaprire i file elencati** nel clone corretto.

Se il modello ha lavorato sulla cartella sbagliata, **ripeti** la frase di apertura e specifica il path assoluto del repo atteso (es. `C:\dev\EMPATHY\empathy-pro-2-cursor\apps\web`).

---

## 3. Workspace multi-root (User rules + più cartelle)

Spesso si usa un file `.code-workspace` con **due root**, ad esempio:

- `nextjs-empathy-pro` — V1 / demo / stesso Supabase in molti flussi
- `empathy-pro-2-cursor` — UI canone Pro 2 (`PRO2_UI_PAGE_CANON.md`, `apps/web`, token Pro 2)

**Regole pratiche:**

1. **User rules** valgono per **entrambe** le root; non indicano da sole quale cartella è quella giusta.
2. Prima di “sistema la pagina X”, verifica **in quale root** esiste il file (cerca path o apri il file dalla sidebar della root corretta).
3. **UI Pro 2.0** (shell `Pro2ModulePageShell`, pagine modulo, token) va implementata nel clone **`empathy-pro-2-cursor`**, salvo task esplicito di porting su V1.
4. In chat puoi **@** un file nella root giusta per ancorare il contesto.

Per dev V1 + Pro 2 insieme vedi nel clone Pro 2: `docs/LOCAL_DEV_WITH_V1.md`.

---

## 4. Windows e OneDrive

Per **Next dev** (build, `.next`, lock file), preferire clone **fuori** da `OneDrive\Documenti` quando possibile (es. `C:\dev\EMPATHY\...`) per ridurre `EBUSY` e sync lenti. Dettagli: `docs/DEVELOPMENT_WINDOWS.md` se presente nel repo che stai usando.

---

## 5. Riferimenti incrociati

- Canone UI Pro 2: **`docs/PRO2_UI_PAGE_CANON.md`** (clone Pro 2; in V1 può esistere blueprint — verifica quale è aggiornata).
- Design system / Figma: **`docs/DESIGN_SYSTEM_AND_FIGMA.md`** (Pro 2).
- Rete dati / generazione / AI: **`docs/EMPATHY_PRO2_DATA_AND_GENERATION_NETWORK.md`** (questo repo).

**Fine.**
