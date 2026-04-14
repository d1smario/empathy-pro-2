# Sviluppo locale: Pro 2.0 e V1 senza conflitti

V1 (`nextjs-empathy-pro`) e Pro 2.0 (`empathy-pro-2-cursor`) sono **due repo Next.js distinti**. Se entrambi fanno `next dev`, **due processi** competono sulle porte e sui processi `node`.

## Soluzione consigliata: due finestre Cursor (due sessioni)

1. **Finestra A — solo V1**  
   - `File` → `Nuova finestra` (o `Ctrl+Shift+N`).  
   - `File` → `Apri cartella…` → `…\EMPATHY\nextjs-empathy-pro`.  
   - Terminale in questa finestra: solo comandi V1 (`npm run dev`, ecc.).

2. **Finestra B — solo Pro 2.0**  
   - Altra finestra Cursor.  
   - `Apri cartella…` → `…\EMPATHY\empathy-pro-2-cursor`.  
   - Terminale qui: solo `npm run dev` di Pro 2.0.

Così **non mischi** cartelle né comandi; è più difficile avviare due dev server “per sbaglio” nella stessa sessione.

## Workspace multi-root (`EMPATHY.code-workspace`)

Utile per **cercare e modificare file** in entrambe le repo nella stessa finestra.  
Svantaggio: è facile avere **due terminali** nella stessa UI e lanciare due `next dev` senza accorgersene.

- Se vuoi **massima chiarezza**: non usare il multi-root mentre sviluppi; usa **due finestre** come sopra.  
- Se usi il multi-root: **una sola** finestra terminale attiva per `next dev`, oppure ricorda: V1 → porta tipica **3000**, Pro 2.0 → **3020** (o successiva).

## Porte (riepilogo)

| Progetto        | Cartella               | Dev (default / script)      |
|----------------|-------------------------|-----------------------------|
| V1             | `nextjs-empathy-pro`    | di solito `http://localhost:3000` |
| Empathy Pro 2.0 | `empathy-pro-2-cursor` | `npm run dev` → da **3020**, poi 3021… se occupata |

Pro 2.0 **non** usa la variabile generica `PORT` del sistema (spesso `3000`) per non rubare la porta a V1. Usa `EMPATHY_PRO2_DEV_PORT` se vuoi cambiare la base (vedi `README.md`).

## Regola pratica

- **Ti serve solo una app?** Chiudi l’altra (`Ctrl+C` nel terminale dove gira `next dev`) oppure non avviarla.  
- **Ti servono entrambe in browser?** Due finestre Cursor, due terminali, **due porte diverse** — nessun problema.

---

## Stesso Supabase e righe “senza builder”

Se Pro 2 e V1 puntano allo **stesso progetto Supabase**, vedrai in calendario anche `planned_workouts` create da **script SQL di demo** nel repo V1 (`nextjs-empathy-pro/supabase/DEMO_*.sql`, `PASTE_DEMO_*`, note `[DEMO_*]`, `mario-rova-demo`, …). Quelle righe **non** contengono `BUILDER_SESSION_JSON::` per scelta: servono a riempire grafici e smoke test, **non** a simulare un salvataggio da Builder/Virya. Non interpretare l’assenza del contratto su quel sottoinsieme come fallimento dell’architettura.

---

*Documento operativo locale; non sostituisce `docs/PLATFORM_AND_DEPLOY.md`.*
