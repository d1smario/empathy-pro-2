# Piano: decode → persistenza → lettura → esposizione (Garmin, Wahoo, WHOOP)

Documento di **sequenza operativa** allineato a `docs/INGEST_DEVICE_AND_LAB_MATRIX.md`, `.cursor/rules/empathy_ingest_envelope.mdc` e alla tassonomia `ObservationDomain` in `@empathy/contracts`.

## Fasi

| Fase | Contenuto | Stato repo (dopo implementazione scaffold) |
|------|-----------|-------------------------------------------|
| **P0** | Contratti: `ObservationIngestTags`, envelope, hint provider | Già presente |
| **P1** | **Decode Garmin** (summary JSON Health/Activity): mappa campi → `ObservationDomain`, merge con hint; scrive `trace_summary.observation` + `contextRefs` su `executed_workouts` | `garmin-observation-from-summary.ts` + `materializeGarminActivitiesFromPullResponse` |
| **P2** | **Persistenza OAuth** WHOOP/Wahoo: tabella dedicata (service role), niente token in client | `037_vendor_oauth_links.sql` |
| **P3** | **Decode WHOOP/Wahoo** (tipi + mapper osservazione da payload noti); fetch HTTP in job successivo | `whoop-observation-from-payload.ts` / `wahoo-observation-from-payload.ts` |
| **P4** | **OAuth browser** WHOOP/Wahoo: authorize + callback (pattern Garmin) | `/api/integrations/whoop/*`, `/api/integrations/wahoo/*` |
| **P5** | **Lettura / esposizione**: API read-only (`executed_workouts` + `device_sync_exports`) | `GET /api/integrations/ingest-clips` |
| **P6** | **Serie ad alta frequenza** (FIT stream, CGM): storage time-series + downsampling motori | Fuori da questo scaffold — vedi matrice ingest |

## Riferimenti vendor (ufficiali)

- **Garmin**: [Connect Developer Program](https://developer.garmin.com/gc-developer-program/), [Health API](https://developer.garmin.com/gc-developer-program/health-api/), [Activity API](https://developer.garmin.com/gc-developer-program/activity-api/)
- **Wahoo**: [Wahoo Cloud API](https://developers.wahooligan.com/cloud), [API reference](https://cloud-api.wahooligan.com/)
- **WHOOP**: [API](https://developer.whoop.com/api/), [OpenAPI JSON](https://api.prod.whoop.com/developer/doc/openapi.json), [Sleep](https://developer.whoop.com/docs/developing/user-data/sleep/), [Recovery](https://developer.whoop.com/docs/developing/user-data/recovery/)

## Principi

- **Adapter-only**: logica vendor in `apps/web/lib/integrations/*`, non nei moduli prodotto.
- **Reality > plan**: decode produce evidenza + qualità; numeri “motore” restano a valle.
- **Serie raw**: non inondare `trace_summary`; solo tag + riepilogo; blob/raw ref in envelope/job quando serve.

## Chiusura fase corrente

Completati: piano (questo file), clip normalizzata v1 in contracts, merge observation, Garmin summary → observation, migration `vendor_oauth_links`, OAuth WHOOP/Wahoo, pull WHOOP (sleep/recovery/workout), pull Wahoo workouts, `ingest-clips` con `device_sync_export_clips`.

Prossimi incrementi consigliati: normalizzazione batch verso time-series; refresh token edge-case; allineare path WHOOP recovery se l’API risponde diversamente da `GET /v2/recovery`.

## Policy ingest multi-device (gate anti-doppione)

- **Tabella**: `athlete_device_ingest_policy` (migration `039_athlete_device_ingest_policy.sql`) — per `athlete_id` + `provider`, campo `streams` JSON (chiavi stabili in `@empathy/contracts`, es. `whoop_workout`, `wahoo_workout`).
- **Default**: WHOOP workout e Wahoo workout **off** di default nel merge applicativo; sleep/recovery WHOOP on; summary Garmin on. Merge con quanto salvato in DB.
- **Enforcement**: `whoop-pull-runner` e `wahoo-pull-runner` chiamano `getMergedIngestStreams` prima di fetch/persist (nessuna quota sprecata se stream off).
- **API**: `GET /api/settings/device-ingest-policy?athleteId=…` (provider collegati + stream effettivi); `PATCH` con `{ athleteId, provider, streams }` dopo auth (`requireAthleteReadContext` / write context).
- **UI**: Impostazioni → sezione **Dispositivi · policy ingest** (`SettingsDeviceIngestPolicy`).
- **Scalabilità**: nuovo vendor = chiavi in contracts + default + check `isStreamEnabled` nell’adapter/pull; il loop operativo resta consumatore di reality già filtrata a monte.

## WHOOP pull (implementato)

- `POST /api/integrations/whoop/pull/run` — body `{ "athleteId": "<uuid>", "limit"?: number, "maxCollectionPages"?: number, "streams"?: { "sleep"?, "recovery"?, "workout"? } }` (ulteriore filtro opzionale); gli stream effettivi sono **l’intersezione** con la policy ingest (`whoop_sleep` / `whoop_recovery` / `whoop_workout`). Il client segue la **paginazione** collection v2 (`next_token` → query `nextToken`) come da [Pagination WHOOP](https://developer.whoop.com/docs/developing/pagination). Auth sessione atleta **oppure** `Authorization: Bearer $WHOOP_PULL_RUN_SECRET` (cron).
- Token: `vendor_oauth_links` (service role). Endpoint: `/v2/activity/sleep`, `/v2/recovery`, `/v2/activity/workout` (range ~14 giorni). Persistenza: `device_sync_exports` (`sync_kind: pull`, `external_event_id`, envelope + `observation`).
- Registry: WHOOP abilitato anche su dominio `training` (workout).
- Env opzionale: `WHOOP_API_BASE_URL`, `WHOOP_PULL_RUN_SECRET`.
- **UI Profilo** (editor → sezione Devices): link `GET /api/integrations/whoop/authorize?athleteId=…`, stato `GET /api/integrations/whoop/link-status`, pulsante «Aggiorna dati WHOOP» → `POST …/whoop/pull/run` (sessione).

## Wahoo Cloud (pull + piani + workout API)

- **Pull ingest** (invariato): `POST /api/integrations/wahoo/pull/run` — se `wahoo_workout` è off in policy, nessuna chiamata. Auth sessione o `WAHOO_PULL_RUN_SECRET`.
- **OAuth** (`/api/integrations/wahoo/authorize`): scope default estesi a `user_read offline_data plans_read plans_write workouts_read workouts_write` (sovrascrivibili con `WAHOO_OAUTH2_SCOPES`). Dopo il cambio scope serve **ricollegare** l’utente.
- **Stato link**: `GET /api/integrations/wahoo/link-status?athleteId=…`
- **Piani** (proxy verso [Cloud API Plans](https://cloud-api.wahooligan.com/#plans)):  
  - `GET/POST /api/integrations/wahoo/plans` (lista / crea; body creazione: `athleteId`, `external_id`, `provider_updated_at`, `plan` JSON, `filename?`)  
  - `GET/PUT/DELETE /api/integrations/wahoo/plans/[id]?athleteId=…` (PUT body: `athleteId`, `provider_updated_at`, `plan`)  
  - `GET /api/integrations/wahoo/plans/[id]/file?athleteId=…` — JSON file plan da CDN (Bearer).
- **Workout** (proxy [Workouts](https://cloud-api.wahooligan.com/#workouts)):  
  - `GET/POST /api/integrations/wahoo/workouts?athleteId=…` (GET: `page`, `per_page`; POST: `name`, `workout_token`, `workout_type_id`, `starts`, `minutes`, opz. `day_code`, `plan_id`, `route_id`)  
  - `GET/PUT/DELETE /api/integrations/wahoo/workouts/[id]?athleteId=…`  
  - `GET /api/integrations/wahoo/workouts/[id]/plans?athleteId=…`
- **Libreria server**: `lib/integrations/wahoo-access-token.ts`, `wahoo-cloud-api.ts` (form `application/x-www-form-urlencoded`), `wahoo-cloud-service.ts`, `wahoo-daycode.ts` (giorni da 2020-01-01 per `day_code`), `wahoo-plan-from-generated-session.ts` (mapper sessione Pro2 → [plan.json](https://cloud-api.wahooligan.com/docs/plan-json-format.pdf) Wahoo).
- **Builder → Wahoo**: `POST /api/integrations/wahoo/push-builder-session` — body JSON: `athleteId`, `planned_date`, `session` (stesso shape `GeneratedSession` del builder), `intensity_channel` (`watt`|`hr`), `workout_type_location` (0 indoor / 1 outdoor), `ftp_w`, `hr_max`, opz. `plan_name`, `threshold_hr_bpm`, `schedule_workout` (default true), `workout_type_id`, `starts_iso`. Crea il plan su Cloud API poi il workout con `plan_id` e `day_code`. Tipi workout di default: bike `40`; corsa sovrascrivibile con `WAHOO_DEFAULT_RUN_WORKOUT_TYPE_ID` (se assente si usa ancora `40` — verificare con `GET /v1/workout_types` sul tenant).
- **UI Profilo** → Devices: Collega Wahoo, «Aggiorna workout Wahoo» (`pull/run`). **UI Builder** (sessione auto): pulsante «Invia a Wahoo» accanto a «Salva nel calendario» quando la sessione è compatibile (non gym, blocchi presenti).

## Strava OAuth (collegamento profilo)

- **DB**: migration `040_vendor_oauth_strava.sql` estende `vendor_oauth_links.vendor` con valore `strava`.
- **Route**: `GET /api/integrations/strava/authorize?athleteId=…`, `GET /api/integrations/strava/callback` (alias opzionale `GET /api/auth/callback/strava` se il redirect URI punta lì), `GET /api/integrations/strava/link-status?athleteId=…`.
- **Persistenza**: token in `vendor_oauth_links` come WHOOP/Wahoo (`lib/integrations/strava-oauth2-api.ts`).
- **UI Profilo** → Devices: «Collega Strava» / «Ricollega Strava». Pull attività da API Strava non ancora cablato (solo link OAuth).

## Ingest clips (implementato)

- `GET /api/integrations/ingest-clips?athleteId=…&from=…&to=…&includeExports=true|false`
- Risposta: `clips` = solo clip `executed_workouts` (compatibile); se `includeExports` ≠ `false`, anche `device_sync_export_clips` da `device_sync_exports` (finestra su `created_at`).

## Variabili d’ambiente (WHOOP / Wahoo / Strava)

| Variabile | Uso |
|-----------|-----|
| `WHOOP_OAUTH2_CLIENT_ID` / `WHOOP_OAUTH2_CLIENT_SECRET` | OAuth2 client |
| `WHOOP_OAUTH2_REDIRECT_URI` | Callback registrato sul developer dashboard WHOOP |
| `WHOOP_OAUTH2_AUTHORIZE_URL` (opz.) | Default `https://api.prod.whoop.com/oauth/oauth2/auth` |
| `WHOOP_OAUTH2_TOKEN_URL` (opz.) | Default `https://api.prod.whoop.com/oauth/oauth2/token` |
| `WHOOP_OAUTH2_SCOPES` (opz.) | Default: `offline read:profile read:body_measurement read:cycles read:recovery read:sleep read:workout` |
| `WHOOP_API_PROFILE_URL` (opz.) | Default `https://api.prod.whoop.com/v2/user/profile/basic` |
| `WHOOP_API_BASE_URL` (opz.) | Default `https://api.prod.whoop.com` (collection v2: `/v2/activity/sleep`, `/v2/recovery`, `/v2/activity/workout`) |
| `WHOOP_PULL_RUN_SECRET` (opz.) | Bearer per `POST …/whoop/pull/run` da cron |
| `WHOOP_API_MAX_COLLECTION_PAGES` (opz.) | Max pagine `nextToken` per ogni stream (default 40, massimo 100) |
| `WAHOO_OAUTH2_CLIENT_ID` / `WAHOO_OAUTH2_CLIENT_SECRET` | OAuth2 client |
| `WAHOO_OAUTH2_REDIRECT_URI` | Callback registrato su Wahoo developers |
| `WAHOO_OAUTH2_AUTHORIZE_URL` (opz.) | Default `https://api.wahooligan.com/oauth/authorize` |
| `WAHOO_OAUTH2_TOKEN_URL` (opz.) | Default `https://api.wahooligan.com/oauth/token` |
| `WAHOO_OAUTH2_SCOPES` (opz.) | Default `user_read offline_data plans_read plans_write workouts_read workouts_write` |
| `WAHOO_API_USER_URL` (opz.) | Default `https://api.wahooligan.com/v1/user` |
| `WAHOO_API_BASE_URL` (opz.) | Default `https://api.wahooligan.com` |
| `WAHOO_PULL_RUN_SECRET` (opz.) | Bearer per `POST …/wahoo/pull/run` da cron |
| `WAHOO_DEFAULT_BIKE_WORKOUT_TYPE_ID` (opz.) | Default `workout_type_id` per workout creato dopo push builder (bike); default numerico `40` se assente |
| `WAHOO_DEFAULT_RUN_WORKOUT_TYPE_ID` (opz.) | Stesso per famiglia corsa nel plan (sport run/foot/…); se assente fallback `40` |
| `STRAVA_OAUTH2_CLIENT_ID` / `STRAVA_OAUTH2_CLIENT_SECRET` | OAuth2 app Strava ([settings/api](https://www.strava.com/settings/api)) |
| `STRAVA_OAUTH2_REDIRECT_URI` | Stesso URL registrato come Authorization Callback / redirect (es. `…/api/integrations/strava/callback` o `…/api/auth/callback/strava`) |
| `STRAVA_OAUTH2_AUTHORIZE_URL` (opz.) | Default `https://www.strava.com/oauth/authorize` |
| `STRAVA_OAUTH2_TOKEN_URL` (opz.) | Default `https://www.strava.com/oauth/token` |
| `STRAVA_OAUTH2_SCOPES` (opz.) | Default `read,activity:read` (virgole, vedi [autenticazione Strava](https://developers.strava.com/docs/authentication/)) |
| `STRAVA_API_ATHLETE_URL` (opz.) | Default `https://www.strava.com/api/v3/athlete` |

Link profilo post-login: query `whoop` / `wahoo` / `strava` (`ok`, `error`, `server_config`, …) come per Garmin (`garmin`).
