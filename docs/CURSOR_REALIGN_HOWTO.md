# Come usare il riallineamento Cursor — **Empathy Pro 2.0 cursor**

Questa pagina spiega **dove** e **come** applicare i blocchi di testo dei file `CURSOR_REALIGN_*.md`, in relazione a **User rules**, **chat** e **workspace multi-root**.

Frase di apertura consigliata in chat: **`RIALLINEAMENTO EMPATHY PRO 2.0 cursor`** + incolla il blocco da `CURSOR_REALIGN_DAILY.md` o `CURSOR_REALIGN_DEEP.md`.

---

## Tre file (stesso set in V1 e Pro 2)

| File | Ruolo |
|------|--------|
| `docs/CURSOR_REALIGN_DAILY.md` | Blocco **breve** — ogni giorno o task piccolo |
| `docs/CURSOR_REALIGN_DEEP.md` | Blocco **lungo** — sessione fuori rotta / tunneling |
| `docs/CURSOR_REALIGN_HOWTO.md` | **Questa guida** (meccanica Cursor, non bussola prodotto) |

**Mirror:** i tre file vivono in `docs/` sia in **`nextjs-empathy-pro`** (V1) sia nel clone **`empathy-pro-2-cursor`**. Quando cambi la bussola, aggiorna **entrambi** i repo (o un solo “source of truth” e copia l’altro nello stesso commit logico).

---

## 1. User rules (Cursor → Settings → Rules)

1. Apri **Cursor → Settings → Rules → User rules** (testo libero, globale sul profilo).
2. Incolla il blocco racchiuso dai triple-backtick da **`CURSOR_REALIGN_DAILY.md`** così resta **sempre** attivo su tutti i progetti e workspace.
3. **Opzionale:** aggiungi in coda il blocco da **`CURSOR_REALIGN_DEEP.md`** solo se vuoi una rule “max” permanente (aumenta rumore e token). Di solito è meglio tenere il DEEP **solo per chat** quando serve.

Le User rules **non** sostituiscono le **Project rules** (`.cursor/rules/*.mdc` nel repo): convivono. Il riallineamento DAILY/DEEP è una bussola trasversale; le rule del repo restano vincolanti su architettura e stabilità.

---

## 2. Chat (senza toccare Settings)

- **Mattina / task breve:** scrivi *RIALLINEAMENTO EMPATHY PRO 2.0 cursor* e incolla il blocco da `CURSOR_REALIGN_DAILY.md`.
- **Sessione degenerata** (repo sbagliato, SQL a caso, UI Pro 2 modificata nel clone sbagliato): incolla il blocco da `CURSOR_REALIGN_DEEP.md` e chiedi esplicitamente di **riaprire i file elencati** nel clone corretto.

Se il modello ha lavorato sulla cartella sbagliata, **ripeti** la frase di apertura e specifica il path assoluto del repo atteso (es. `…\empathy-pro-2-cursor\apps\web`).

---

## 3. Workspace multi-root (User rules + più cartelle)

Spesso si usa un file `.code-workspace` con **due root**, ad esempio:

- `nextjs-empathy-pro` — track V1 / demo / stesso Supabase in molti flussi
- `empathy-pro-2-cursor` — **Empathy Pro 2.0 cursor** (UI canone Figma / `PRO2_UI_PAGE_CANON.md`, `apps/web`, token Pro 2)

**Regole pratiche:**

1. **User rules** valgono per **entrambe** le root; non indicano da sole quale cartella è quella giusta.
2. Prima di “sistema la pagina X”, verifica **in quale root** esiste il file (cerca path o apri il file dalla sidebar della root corretta).
3. **UI Pro 2.0** (shell `Pro2ModulePageShell`, pagine modulo, token Tailwind/`apps/web/app/globals.css`) va implementata nel clone **`empathy-pro-2-cursor`**, non confondendo con la sola V1 salvo task esplicito di porting.
4. In chat puoi **@** un file nella root giusta per ancorare il contesto (es. `@empathy-pro-2-cursor/apps/web/...`).

Per dev V1 + Pro 2 insieme vedi: **`docs/LOCAL_DEV_WITH_V1.md`**.

---

## 4. Windows e OneDrive

Per **Next dev** (build, `.next`, lock file), preferire clone **fuori** da `OneDrive\Documenti` quando possibile (es. `C:\dev\EMPATHY\empathy-pro-2-cursor`) per ridurre `EBUSY` e sync lenti.

---

## 5. Riferimenti incrociati

- Canone UI Pro 2: **`docs/PRO2_UI_PAGE_CANON.md`**
- Design system / Figma: **`docs/DESIGN_SYSTEM_AND_FIGMA.md`**
- Rete dati / generazione / AI (Pro 2, mappa file): **`docs/EMPATHY_PRO2_DATA_AND_GENERATION_NETWORK.md`** — in V1 il contenuto non è duplicato: stesso riferimento al path nel clone Pro 2.

**Fine.**
