import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Path assoluto al config: evita "content missing" quando cwd ≠ apps/web */
const tailwindConfig = path.join(__dirname, "tailwind.config.js");

export default {
  plugins: {
    tailwindcss: { config: tailwindConfig },
    autoprefixer: {},
  },
};
