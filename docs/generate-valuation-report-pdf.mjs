/**
 * Genera PDF del report valorizzazione Empathy.
 * Uso: node docs/generate-valuation-report-pdf.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "EMPATHY_WORK_VALUATION_REPORT_2026.html");
const pdfPath = path.join(__dirname, "EMPATHY_WORK_VALUATION_REPORT_2026.pdf");

async function main() {
  if (!fs.existsSync(htmlPath)) {
    console.error("HTML mancante:", htmlPath);
    process.exit(1);
  }

  let puppeteer;
  try {
    puppeteer = await import("puppeteer");
  } catch {
    console.error("Installazione puppeteer...");
    const { execSync } = await import("node:child_process");
    execSync("npm install puppeteer --no-save", {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
    });
    puppeteer = await import("puppeteer");
  }

  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    const html = fs.readFileSync(htmlPath, "utf8");
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", right: "12mm", bottom: "14mm", left: "12mm" },
    });
    const stat = fs.statSync(pdfPath);
    console.log(`PDF generato: ${pdfPath}`);
    console.log(`Dimensione: ${(stat.size / 1024).toFixed(1)} KB`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
