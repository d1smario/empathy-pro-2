/**
 * Diagnostica file FIT workout: stampa TUTTI gli step grezzi con tutti
 * i campi (duration_*, target_*, custom_target_*, ecc).
 *
 * Uso:
 *   node apps/web/scripts/inspect-fit-workout.mjs <path-al-file.fit>
 *
 * Esempio:
 *   node apps/web/scripts/inspect-fit-workout.mjs ./2026-05-29_tracks.fit
 */
import fs from "node:fs";
import path from "node:path";

const fitPath = process.argv[2];
if (!fitPath || !fs.existsSync(fitPath)) {
  console.error("Usage: node inspect-fit-workout.mjs <path-al-file.fit>");
  process.exit(1);
}

const buf = fs.readFileSync(fitPath);
console.log(`File: ${path.resolve(fitPath)} (${buf.length} bytes)`);

const { calculateCRC, getArrayBuffer, readRecord } = await import("empathy-fit-file-parser-binary");

const ab = getArrayBuffer(buf);
const dv = new DataView(ab);
const headerSize = dv.getUint8(0);
const protocolVersion = dv.getUint8(1);
const profileVersion = dv.getUint16(2, true);
const dataSize = dv.getUint32(4, true);
console.log(`Header: size=${headerSize} proto=${protocolVersion} profile=${profileVersion} dataSize=${dataSize}`);

const opts = {
  force: true,
  speedUnit: "km/h",
  lengthUnit: "m",
  temperatureUnit: "celsius",
  elapsedRecordField: true,
  pressureUnit: "bar",
  mode: "list",
};

let offset = headerSize;
const stop = headerSize + dataSize;
const messages = [];
const definitions = {};
let safety = 0;
while (offset < stop && safety++ < 100000) {
  try {
    const out = readRecord(dv, definitions, messages, offset, opts, () => {}, () => {});
    offset = out.nextIndex;
    if (out.message != null) messages.push(out);
  } catch (e) {
    console.warn("readRecord error at offset", offset, e.message);
    break;
  }
}

const workoutSteps = [];
const workouts = [];
const fileIds = [];
const all = [];
for (const m of messages) {
  const name = m?.message?.name ?? m?.message?.messageType ?? null;
  if (m.message) all.push({ name, fields: m.message.fields ?? m.message });
  if (name === "workout_step") workoutSteps.push(m.message.fields ?? m.message);
  if (name === "workout") workouts.push(m.message.fields ?? m.message);
  if (name === "file_id") fileIds.push(m.message.fields ?? m.message);
}

console.log(`\nTotale messaggi: ${messages.length} (workout_step=${workoutSteps.length}, workout=${workouts.length}, file_id=${fileIds.length})`);

console.log(`\n=== file_id ===`);
for (const f of fileIds) console.log(JSON.stringify(f, null, 2));

console.log(`\n=== workout (${workouts.length}) ===`);
for (const w of workouts) console.log(JSON.stringify(w, null, 2));

console.log(`\n=== workout_step (${workoutSteps.length}) ===`);
for (let i = 0; i < workoutSteps.length; i++) {
  console.log(`\n--- step[${i + 1}] ---`);
  console.log(JSON.stringify(workoutSteps[i], null, 2));
}

const messageNames = [...new Set(all.map((m) => m.name))];
console.log(`\nTipi di messaggi presenti: ${JSON.stringify(messageNames)}`);
