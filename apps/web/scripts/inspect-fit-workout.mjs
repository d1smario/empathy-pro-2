/**
 * Diagnostica file FIT workout: stampa TUTTI gli step grezzi con tutti
 * i campi (duration_*, target_*, custom_target_*, ecc).
 *
 * Uso (dalla cartella apps/web):
 *   node scripts/inspect-fit-workout.mjs <path-al-file.fit>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const fitPath = process.argv[2];
if (!fitPath || !fs.existsSync(fitPath)) {
  console.error("Usage: node inspect-fit-workout.mjs <path-al-file.fit>");
  process.exit(1);
}

const buf = fs.readFileSync(fitPath);
console.log(`File: ${path.resolve(fitPath)} (${buf.length} bytes)`);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.join(__dirname, "..", "..", "..", "node_modules", "fit-file-parser", "dist", "binary.js"),
  path.join(__dirname, "..", "node_modules", "fit-file-parser", "dist", "binary.js"),
];
let parserModulePath = null;
for (const c of candidates) if (fs.existsSync(c)) { parserModulePath = c; break; }
if (!parserModulePath) {
  console.error("fit-file-parser not found in node_modules. Run `npm i` from monorepo root.");
  process.exit(1);
}
const { calculateCRC, getArrayBuffer, readRecord } = await import(pathToFileURL(parserModulePath).href);

const READ_OPTIONS = {
  force: true,
  speedUnit: "km/h",
  lengthUnit: "m",
  temperatureUnit: "celsius",
  elapsedRecordField: true,
  pressureUnit: "bar",
  mode: "list",
};

const blob = new Uint8Array(getArrayBuffer(buf));
const headerLength = blob[0];
const dataLength = blob[4] + (blob[5] << 8) + (blob[6] << 16) + (blob[7] << 24);
const crcStart = dataLength + headerLength;
console.log(`Header: size=${headerLength} dataSize=${dataLength} crcStart=${crcStart}`);

const messageTypes = [];
const developerFields = [];
let loopIndex = headerLength;
let startDate;
let lastStopTimestamp;
let pausedTime = 0;

const workoutSteps = [];
const workouts = [];
const fileIds = [];
const allMessageTypes = new Set();
let recordCount = 0;

while (loopIndex < crcStart) {
  let parsed;
  try {
    parsed = readRecord(blob, messageTypes, developerFields, loopIndex, READ_OPTIONS, startDate, pausedTime);
  } catch (e) {
    console.warn("readRecord error at offset", loopIndex, e.message);
    break;
  }
  const { nextIndex, messageType, message } = parsed;
  if (nextIndex == null || nextIndex <= loopIndex) {
    console.warn("readRecord stuck at offset", loopIndex);
    break;
  }
  loopIndex = nextIndex;
  recordCount++;
  if (messageType) allMessageTypes.add(messageType);

  if (messageType === "workout_step" && message) workoutSteps.push(message);
  if (messageType === "workout" && message) workouts.push(message);
  if (messageType === "file_id" && message) fileIds.push(message);
}

console.log(`\nTotale record: ${recordCount} (workout_step=${workoutSteps.length}, workout=${workouts.length}, file_id=${fileIds.length})`);
console.log(`Tipi messaggi: ${[...allMessageTypes].join(", ")}`);

console.log(`\n=== file_id ===`);
for (const f of fileIds) console.log(JSON.stringify(f, null, 2));

console.log(`\n=== workout (${workouts.length}) ===`);
for (const w of workouts) console.log(JSON.stringify(w, null, 2));

console.log(`\n=== workout_step (${workoutSteps.length}) ===`);
for (let i = 0; i < workoutSteps.length; i++) {
  console.log(`\n--- step[${i + 1}] ---`);
  console.log(JSON.stringify(workoutSteps[i], null, 2));
}
