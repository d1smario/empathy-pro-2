# Spline — contenuti 3D per esercizi e asset simili (Empathy Pro 2.0)

**Obiettivo:** presentazioni **3D interattive** per **esercizi in palestra**, varianti, e in prospettiva altri asset dove serve chiarezza anatomica / movimento (in linea con riferimenti tipo **MyFit Coach**: modelli 3D guidati, non solo thumbnail statici).

**Strumento:** [Spline](https://spline.design/) — design 3D nel browser, export per web (scene pubbliche o self-hosted secondo piano e documentazione Spline).

## Ruolo architetturale

- **Solo presentation layer**: i dati canonici dell’esercizio (nome, muscoli, serie, parametri nel builder) restano in **contratti / catalogo** (`@empathy/contracts`, `domain-training`). Spline **non** è sorgente di verità biologica o di carico.
- **Mapping**: `exerciseId` (o chiave catalogo) → **scene URL** o embed ID Spline, eventualmente varianti per angolo o fase del movimento.
- **Fallback obbligatorio**: connessione lenta, WebGL non disponibile o preferenze accessibilità → immagine 2D, video loop o illustrazione statica (stesso layout UI).

## Implementazione nel monorepo

- Pacchetto consigliato: **`packages/integrations-spline`** (wrapper tipizzato + costanti) oppure modulo dedicato sotto `apps/web/components/spline/` che importa solo la runtime ufficiale (`@splinetool/react-spline` o viewer aggiornato — allineare alla doc Spline al momento dello sviluppo).
- **Lazy load** delle scene (code splitting); niente caricamento di tutte le scene sulla home.
- **Performance**: limitare scene pesanti su mobile; opzione “modalità leggera” in impostazioni.

## Contenuti e workflow

1. **Asset pipeline**: modellazione in Spline → pubblicazione scena → registrazione URL/ID in **catalogo esercizi** (DB o JSON versionato) gestito da Empathy.
2. **Coerenza con Figma**: frame UI in Figma definiscono **spazio e ratio** del viewport 3D; token di bordo/ombra coerenti con `docs/DESIGN_SYSTEM_AND_FIGMA.md`.
3. **Versioning**: cambio scena = bump versione asset per non rompere sessioni salvate che referenziano embed precedenti (o policy di redirect documentata).

## Privacy e sicurezza

- Scene **pubbliche** su infrastruttura Spline: non includere dati personali nel file 3D.
- Se in futuro si usano scene **private** / tokenizzate, gestire segreti solo server-side e non esporre chiavi nel client.

## Variabili ambiente

Eventuali chiavi o URL base (se richiesti dal piano Spline) in `.env.example`; spesso le scene pubbliche usano solo URL noti — documentare al momento dell’integrazione.
