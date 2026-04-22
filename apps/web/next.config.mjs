import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

if (process.env.NEXT_ENABLE_HSTS === "1") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

/** In dev Windows `npm run dev` imposta `NEXT_DIST_DIR` relativo (`../.empathy-pro2-next-dev`). Build prod: `.next`. */
const distDir = process.env.NEXT_DIST_DIR?.trim() || ".next";

/** Cache filesystem webpack disattivata: evita chunk mancanti (`592.js`) e pack.gz ENOENT su sync cloud. */
const disableWebpackCache =
  process.env.EMPATHY_PRO2_NO_WEBPACK_CACHE === "1";

/** `fit-file-parser` non esporta `./dist/binary.js` né `./package.json`; risolviamo la cartella del pacchetto. */
function resolveFitFileParserRoot() {
  const candidates = [
    path.join(__dirname, "..", "..", "node_modules", "fit-file-parser"),
    path.join(__dirname, "node_modules", "fit-file-parser"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(path.join(p, "package.json"))) return p;
  }
  const main = require.resolve("fit-file-parser");
  let dir = path.dirname(main);
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
        if (pkg?.name === "fit-file-parser") return dir;
      } catch {
        // continue
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("fit-file-parser: impossibile risolvere la directory del pacchetto per l’alias webpack.");
}

const FIT_FILE_PARSER_BINARY = path.join(resolveFitFileParserRoot(), "dist", "binary.js");

const nextConfig = {
  poweredByHeader: false,
  distDir,
  experimental: {
    optimizePackageImports: ["lucide-react"],
    /** Monorepo (Next 14.2): tracing fino alla root repo per `packages/*` su Vercel. */
    outputFileTracingRoot: path.join(__dirname, "..", ".."),
    /** `pdf-parse` (fs nativo) — Next 14: chiave sotto `experimental`, non `serverExternalPackages`. */
    serverComponentsExternalPackages: ["pdf-parse"],
  },
  /** Alias URL (V1 / naming): virya → vyria, analyzer → analytics. */
  async redirects() {
    return [
      { source: "/training/virya", destination: "/training/vyria", permanent: false },
      { source: "/training/virya/:path*", destination: "/training/vyria/:path*", permanent: false },
      { source: "/training/analyzer", destination: "/training/analytics", permanent: false },
      { source: "/training/analyzer/:path*", destination: "/training/analytics/:path*", permanent: false },
    ];
  },
  headers: async () => [
    {
      source: "/:path*",
      headers: securityHeaders,
    },
  ],
  transpilePackages: [
    "@empathy/contracts",
    "@empathy/domain-bioenergetics",
    "@empathy/domain-knowledge",
    "@empathy/domain-nutrition",
    "@empathy/domain-physiology",
    "@empathy/domain-reality",
    "@empathy/domain-training",
    "@empathy/domain-twin",
    "@empathy/integrations-logmeal",
    "@empathy/integrations-spline",
    "@empathy/integrations-stripe",
    "@empathy/integrations-supabase",
  ],
  eslint: {
    dirs: ["app", "components", "core", "lib"],
  },
  webpack: (config, { dev }) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "empathy-fit-file-parser-binary": FIT_FILE_PARSER_BINARY,
    };
    if (dev && disableWebpackCache) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
