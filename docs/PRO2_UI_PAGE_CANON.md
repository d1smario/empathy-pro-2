# Pro 2.0 — canone pagina (modello grafico e strutturale)

**Pagina di riferimento:** `Training / Builder` → `apps/web/modules/training/views/TrainingBuilderRichPageView.tsx`.

Questo file è il **contratto visivo e di layout** da replicare sulle altre pagine prodotto Pro 2.0 (stessa gerarchia, stessi tipi di superficie, stessa logica di accenti). Non sostituisce `docs/DESIGN_SYSTEM_AND_FIGMA.md` (Figma/token globali) ma **implementa** quel sistema in una vista completa.

---

## 1. Shell pagina

| Elemento | Implementazione |
|----------|-----------------|
| Sfondo | `min-h-full bg-gradient-to-b from-zinc-950 via-black to-black` |
| Contenitore | `mx-auto max-w-6xl` + `px-4 py-8 sm:px-8 sm:py-10` |
| Ritmo verticale | `space-y-10` tra blocchi principali |
| Testo corpo | Titoli `text-white`; secondario `text-gray-400`; codice / enfasi `text-*-200/90` o `text-gray-500` |
| Eyebrow modulo | `font-mono text-[0.65rem] font-bold uppercase tracking-[0.25em] text-orange-400` (variante: allineare l’accento al modulo, es. cyan per training hub) |

---

## 2. Header (hero di pagina)

- Bordo inferiore: `border-b border-white/10 pb-8`.
- Layout: colonna su mobile; `sm:flex-row sm:items-end sm:justify-between` con azioni a destra.
- Azioni: `Pro2Link` / `Pro2Button` da `apps/web/components/ui/empathy/` con bordi **tinted** (`border-*-500/30`, `bg-*-500/10`, hover coerenti).
- Una riga di copy massimo `max-w-xl`; niente muri di testo sopra la piega.

---

## 3. Sezioni (card “modulo”)

Pattern ricorrente:

- Contenitore: `rounded-2xl border border-{accent}-500/25` + fondo **tinted** o gradiente leggero verso nero.
- Esempi dalla pagina canone:
  - Generazione engine: `border-orange-500/25 bg-orange-500/5`.
  - Sport / famiglie: `border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-950/[0.12] via-orange-950/[0.08] to-black/85 p-6 shadow-inner`.
  - Calendario / liste: `border-cyan-500/25` + gradiente cyan/violet/black analogo.
- **Intestazione sezione** (ripetibile):
  - Icona in riquadro `h-11 w-11 rounded-xl border-2 border-{accent}-400/45 bg-{accent}-500/35` + `shadow-[0_0_16px_rgba(…)]`.
  - `h2` `text-lg font-bold text-white`.
  - Sottotitolo `text-sm text-gray-400`.

---

## 4. KPI (quattro metriche in griglia)

- Griglia: `grid gap-3 sm:grid-cols-2 lg:grid-cols-4`.
- Componente: `KpiCard` nella stessa view (mappa `ACCENT_KPI`).
- Accenti canonici: **cyan**, **orange**, **violet**, **emerald** (più **slate** per stati neutri).
- Ogni KPI: `rounded-2xl border`, `backdrop-blur-sm`, barra superiore gradient (`h-1`), icona Lucide in wrap arrotondato con bordo e glow.

Quando si aggiungono KPI altrove, **riusare la stessa mappa token** (non inventare una quinta famiglia cromatica senza motivo).

---

## 5. Controlli compatti (form “builder style”)

- Raggruppare input in **tile** `rounded-xl border border-{accent}-500/35 bg-{accent}-500/10 p-3`.
- Icona Lucide `h-5 w-5 shrink-0 text-{accent}-300` allineata in alto a sinistra della tile.
- Label: `text-xs text-gray-400`; field: `rounded-lg border border-white/15 bg-black/50 text-sm text-white`.
- Primary CTA: `Pro2Button` con gradiente **fuchsia → violet** e ombra viola (come “Genera sessione”).
- Messaggi: errore `text-amber-300`; successo `text-emerald-300/90`.

---

## 6. Macro settori sport (2×2 + striscia icone)

- **Griglia macro:** `grid grid-cols-2 gap-4` (sempre quattro tile grandi, non una sola riga su desktop).
- **Tile macro:** `min-h-[11rem] sm:min-h-[12rem]`, `rounded-2xl border-2`, stati idle/active da `SPORT_MACRO_SECTORS` in `apps/web/lib/training/builder/sport-macro-palette.ts` (`macroIdle` / `macroActive`).
- **Anteprime sport nella tile:** una **sola fila orizzontale** di quadratini:
  - `flex flex-row flex-nowrap items-center gap-2 overflow-x-auto`
  - ogni icona: `h-10 w-10 shrink-0` (o `sm:h-11 w-11`), `rounded-lg`, `bg-black/25`, `ring-1 ring-white/10`
  - **Vietato** usare qui una `grid` a più colonne che va a capo (regola: `.cursor/rules/empathy_training_macro_sport_strip.mdc`).
- **Dettaglio disciplina** (sotto): griglia `grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6` ammessa; chip con `rounded-2xl`, `SportDisciplineGlyph` in contenitore `h-[3.75rem] w-[3.75rem]` + `iconRing` dal palette.

---

## 7. Icone disciplina (geometria e colore)

- Componente: `apps/web/components/training/SportDisciplineGlyph.tsx`.
- **viewBox** fisso `0 0 36 36` (SVG “app-like”, non solo stroke).
- **Riempimenti espliciti** (hex / gradienti); non affidare l’aspetto a `currentColor` bianco.
- Gradienti SVG: usare **`useId()`** per `id` univoci su istanze multiple.
- Chiavi glifo: `apps/web/lib/training/builder/sport-glyph-id.ts` — ogni nuovo sport passa da qui + palette + glifo.

---

## 8. Palette e token globali

- Variabili CSS brand: `apps/web/styles/tokens.css` (viola, rosa, arancio, void, surface, border, glow).
- Settori sport: colori **per macro** (cyan / orange / fuchsia / emerald) + **per chip** (`iconRing` in `sport-macro-palette.ts`).
- Allineamento linguaggio UI generico: `.cursor/rules/empathy_pro2_ui_language.mdc`.

---

## 9. Checklist per nuove pagine Pro 2

1. Stessa shell (`max-w-6xl`, gradient, `space-y-10`).
2. Header con eyebrow + titolo + azioni primarie/secondarie (Empathy UI).
3. Sezioni con `rounded-2xl` + bordo accent `/25` + tint `/5` o gradient leggero.
4. KPI o blocchi riepilogo: riuso pattern `KpiCard` / stessi accenti.
5. Input: tile con bordo accent, mai form full-width denso senza gerarchia.
6. Liste / griglie di scelta: rispettare regole dedicate (es. striscia orizzontale vs griglia dettaglio).
7. Icone custom: viewBox coerente, multicolore, id gradiente sicuri.

---

## 10. Primitive condivise (altre pagine modulo)

- **`Pro2ModulePageShell`** — `apps/web/components/shell/Pro2ModulePageShell.tsx`: shell §1–§2 (gradient, `max-w-6xl`, header con eyebrow + azioni).
- **`Pro2SectionCard`** — `apps/web/components/shell/Pro2SectionCard.tsx`: sezione §3 con header icona `h-11` e accenti `fuchsia` | `violet` | `cyan` | `orange` | `emerald` | `amber` | `slate`.
- **Eyebrow per modulo** — `apps/web/core/navigation/module-ui-accent.ts` (`moduleEyebrowClass`).
- **Superfici route** — `StandardModuleSurface` (hub/coach/settings) e `GenerativeModuleSurface` (profile, training, nutrition, …) usano shell + sezioni; training hub/vyria in `modules/training/views/*`.

## 11. Pattern card "device data" (Calendar + Analyzer)

Tre pattern figli della Section §3 standardizzano l’esposizione dei dati device (Garmin/Whoop/Strava/Wahoo/file) in modo coerente con Physiology. Tutte e tre **non** fanno fetch direttamente verso vendor: leggono dalle API canoniche `/api/training/planned-window`, `/api/health/daily-wellness`, `/api/training/session-series`, `/api/training/analytics`.

### 11.a Session detail (sessione eseguita)

- Componente: `apps/web/components/training/CalendarDaySessionDetail.tsx` (id ancora `#day-session-detail`).
- Helper VM: `apps/web/lib/training/session-detail-summary.ts`.
- Sorgente: `executed_workouts.trace_summary` + (best-effort) `executed_workout_series` via `/api/training/session-series`.
- Composizione:
  1. **Header**: `Pro2SectionCard` accent `cyan`, glifo disciplina (`SportDisciplineGlyph`) + titolo (sport · durata · data) + sottotitolo provenienza (`source: garmin | strava | file fit | …`).
  2. **KPI hero**: 4 tile (durata, distanza, kJ, TSS) + 2 tile rotanti (power avg, HR avg) — accenti canonici da §4.
  3. **Tabella secondaria min/avg/max**: chip-table compatta `power · hr · cadence · speed · altitude · temperature`. Riga vuota se la metrica manca.
  4. **Grafico**: `TrainingSingleTraceChart` con selettore canale (power · hr · speed · cadence · altitude · temperature). Se le serie non sono in `trace_summary` viene fatta una chiamata best-effort a `/api/training/session-series`.

### 11.b Wellness detail (giornata, sonno e recovery)

- Componente: `apps/web/components/training/CalendarDayWellnessDetail.tsx` (id ancora `#day-wellness-detail`).
- API: `/api/health/daily-wellness?athleteId=…&date=YYYY-MM-DD` → `buildPhysiologyDailyPanel`.
- Composizione:
  1. **Header**: `Pro2SectionCard` accent `violet` con glifo "moon"/"heart" e provenienza badge (`whoop`, `garmin`, …).
  2. **KPI grid 2×4**: sonno totale, HRV, RHR, passi, calorie attive, frequenza respiratoria, temperatura cute, stress (riusano `KpiCard` token).
  3. **Sleep stages bar**: barre orizzontali colorate per `deep · rem · light · awake` (proporzionali al totale).
  4. **Hypnogram**: `TrainingSingleTraceChart` mono-canale stage-over-time quando il provider espone l’ipnogramma.

Sul calendario, ogni cella che ha wellness mostra un mini-badge (`.tc2-calendar-wellness`, classe definita in `apps/web/app/globals.css`) tipo `Z 7h12 · HRV 58`. Click cella → soft scroll a `#day-wellness-detail` se non c’è executed, altrimenti a `#day-session-detail`.

### 11.c Analyzer cross-channel intra-session

- Componente: `apps/web/components/training/TrainingAnalyzerCrossChannelSection.tsx`.
- Helper: `apps/web/lib/training/analytics/cross-channel-session.ts`.
- Sorgente: `/api/training/analytics` aggiunge `crossChannelSessions` ricavato da `executed_workouts` + `device_sync_exports` filtrati `provider = 'cgm'`.
- Composizione:
  1. **Header**: `Pro2SectionCard` accent `orange`, sottotitolo "power/HR vs glucosio · 1 sessione attiva".
  2. **Selettore sessione**: chip orizzontale (data + sport) per saltare tra sessioni con CGM disponibile.
  3. **Grafico**: `ComposedChart` (Recharts) con asse Y sinistro **power/HR** (linee) + asse Y destro **glucosio** (scatter). X = secondi dall’inizio sessione.

Resta valido il principio: gli **overlay metrici trend (42g)** restano nel `TrainingCalendarAnalyzer` esistente. Le metriche continue (lattato, NAD, NO, Na/K) vengono solo aggiunte agli overlay senza nuova griglia separata (cfr. `OVERLAY_METRIC_DEFS` in `apps/web/lib/training/analytics/executed-metric-aggregates.ts`).

---

## 12. Riferimenti incrociati

| Documento / regola | Ruolo |
|--------------------|--------|
| `docs/DESIGN_SYSTEM_AND_FIGMA.md` | Figma, token, WCAG, pipeline |
| `docs/DEVICE_DATA_TO_UI_MATRIX.md` | Mapping campi device → tabelle → UI surface |
| `.cursor/rules/empathy_pro2_ui_language.mdc` | Densità, generative island, separation da V1 |
| `.cursor/rules/empathy_training_macro_sport_strip.mdc` | Fila orizzontale quadratini nei macro sport |
| `components/shell/BrutalistAppBackdrop.tsx` | Canvas marketing / matrix (contesto shell) |

**Fine.** Aggiornare questo file quando il canone della pagina riferimento cambia in modo intenzionale (es. nuovo tipo di sezione approvato in design review).
