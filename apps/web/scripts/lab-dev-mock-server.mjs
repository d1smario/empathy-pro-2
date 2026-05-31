/**
 * Local dev sidecar for Biomech pose CV, Aero geometry CV, and OpenCap import.
 * Start: npm run lab:mock (from apps/web) — default port 3310.
 */
import http from "node:http";

const PORT = Number.parseInt(process.env.PORT ?? process.env.LAB_MOCK_PORT ?? "3310", 10);
const HOST = process.env.LAB_MOCK_HOST ?? (process.env.PORT ? "0.0.0.0" : "127.0.0.1");
const DEV_TOKEN = process.env.LAB_MOCK_TOKEN ?? "dev-local-lab";

const poseProposal = {
  version: "pose_proposal_v1",
  confidence01: 0.82,
  provider: "lab-dev-mock",
  model: "golden-fixture-v1",
  jointAngles: [
    { joint: "knee", side: "left", angleDeg: 142, confidence01: 0.9 },
    { joint: "knee", side: "right", angleDeg: 138, confidence01: 0.88 },
  ],
  movementPatterns: { pelvicStability01: 0.8, kneeTracking01: 0.7 },
  riskScores: { kneeRisk01: 0.2, lumbarRisk01: 0.65 },
};

const geometryProposal = {
  version: "geometry_proposal_v1",
  confidence01: 0.76,
  provider: "lab-dev-mock",
  position: { torsoAngleDeg: 11, headDropMm: 42, confidence01: 0.7 },
  geometry: { frontalAreaM2: 0.36, projectedAreaM2: 0.31 },
  equipment: { helmet: "aero", wheels: "disc" },
  cdaSurrogateM2: 0.295,
};

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function authorized(req) {
  const auth = req.headers.authorization ?? "";
  if (!auth) return true;
  return auth === `Bearer ${DEV_TOKEN}`;
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { ok: true, service: "lab-dev-mock", port: PORT });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  if (!authorized(req)) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  const url = req.url?.split("?")[0] ?? "";

  if (url === "/v1/extract" || url.endsWith("/v1/extract")) {
    let body;
    try {
      body = await readJson(req);
    } catch {
      sendJson(res, 400, { error: "invalid_json" });
      return;
    }

    if (body.version === "geometry_request_v1") {
      sendJson(res, 200, geometryProposal);
      return;
    }

    sendJson(res, 200, poseProposal);
    return;
  }

  if (url === "/v1/session/import" || url.endsWith("/v1/session/import")) {
    let body;
    try {
      body = await readJson(req);
    } catch {
      sendJson(res, 400, { error: "invalid_json" });
      return;
    }

    if (!body.sessionId) {
      sendJson(res, 404, { error: "session_not_found" });
      return;
    }

    sendJson(res, 200, {
      poseProposal: { ...poseProposal, provider: "opencap", model: "lab-dev-mock-opencap" },
    });
    return;
  }

  sendJson(res, 404, { error: "not_found" });
});

server.listen(PORT, HOST, () => {
  console.log(`[lab-dev-mock] listening on http://${HOST}:${PORT}`);
  console.log(`[lab-dev-mock] token (optional): ${DEV_TOKEN}`);
});
