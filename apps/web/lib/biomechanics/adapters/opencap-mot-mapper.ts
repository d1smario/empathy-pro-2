import type { BiomechanicsJointAngleSample } from "@empathy/contracts";

/** OpenSim coordinate name → EMPATHY joint contract mapping (subset). */
const OPENSIM_COORD_MAP: Record<string, { joint: BiomechanicsJointAngleSample["joint"]; side: BiomechanicsJointAngleSample["side"] }> = {
  knee_angle_l: { joint: "knee", side: "left" },
  knee_angle_r: { joint: "knee", side: "right" },
  hip_flexion_l: { joint: "hip", side: "left" },
  hip_flexion_r: { joint: "hip", side: "right" },
  ankle_angle_l: { joint: "ankle", side: "left" },
  ankle_angle_r: { joint: "ankle", side: "right" },
  pelvis_tilt: { joint: "back", side: "midline" },
  lumbar_extension: { joint: "back", side: "midline" },
};

export type OpenCapMotParseResult = {
  jointAngles: BiomechanicsJointAngleSample[];
  sampleCount: number;
};

function parseMotHeader(lines: string[]): { columns: string[]; dataStart: number } {
  let dataStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line.toLowerCase().startsWith("endheader")) {
      dataStart = i + 1;
      break;
    }
  }

  const headerLine = lines[dataStart]?.trim() ?? "";
  const columns = headerLine.split(/\s+/).filter(Boolean);
  return { columns, dataStart: dataStart + 1 };
}

export function parseOpenCapMotToJointAngles(motText: string): OpenCapMotParseResult {
  const lines = motText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 3) {
    return { jointAngles: [], sampleCount: 0 };
  }

  const { columns, dataStart } = parseMotHeader(lines);
  const dataRows = lines.slice(dataStart).map((line) => line.trim().split(/\s+/).map(Number));
  const sampleCount = dataRows.length;

  const jointAngles: BiomechanicsJointAngleSample[] = [];

  for (const col of columns) {
    const mapping = OPENSIM_COORD_MAP[col];
    if (!mapping) continue;
    const colIdx = columns.indexOf(col);
    const values = dataRows
      .map((row) => row[colIdx])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (!values.length) continue;

    const meanDeg = values.reduce((sum, v) => sum + v, 0) / values.length;
    jointAngles.push({
      joint: mapping.joint,
      side: mapping.side,
      angleDeg: meanDeg,
      confidence01: 0.75,
    });
  }

  return { jointAngles, sampleCount };
}
