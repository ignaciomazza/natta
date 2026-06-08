import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const execFileAsync = promisify(execFile);
let sharp = null;

try {
  sharp = require("sharp");
} catch {
  sharp = null;
}

const projectRoot = process.cwd();
const outputDir = process.argv[2];

if (!outputDir) {
  throw new Error("Usage: node scripts/generate-budget-assets.mjs <output-dir>");
}

const cobotsRoot = "/Users/ignaciomazza/Documents/cobots/cobots-studio";
const cobotsLogoPath = path.join(cobotsRoot, "public/cobots-transparente.png");
const nattaHeroPath = path.join(
  projectRoot,
  "public/images/Instagram_files/633114726_18560669452017460_185298347140133489_n.jpg",
);

const toDataUrl = async (filePath, mimeType, options = {}) => {
  let buffer = await fs.readFile(filePath);

  if (sharp && options.width) {
    const image = sharp(buffer).resize({
      width: options.width,
      withoutEnlargement: true,
    });

    buffer =
      options.format === "png"
        ? await image.png({ compressionLevel: 9 }).toBuffer()
        : await image.jpeg({ quality: options.quality ?? 82 }).toBuffer();
  }

  return `data:${mimeType};base64,${buffer.toString("base64")}`;
};

const [logoDataUrl, heroDataUrl] = await Promise.all([
  toDataUrl(cobotsLogoPath, "image/png", { format: "png", width: 320 }),
  toDataUrl(nattaHeroPath, "image/jpeg", {
    format: "jpeg",
    quality: 82,
    width: 1200,
  }),
]);

const stages = [
  {
    name: "Web y pedido asistido",
    description:
      "Web pública, catálogo visible, experiencia visual, flujo inicial de pedido, cálculo de totales y reglas básicas de fecha, pago y entrega.",
    price: "USD 350",
  },
  {
    name: "Base de datos y gestión",
    description:
      "Persistencia de pedidos, modelos de catálogo, precios, disponibilidad, cupos diarios y estados de pedido.",
    price: "USD 250",
  },
  {
    name: "Backoffice para Natta",
    description:
      "Panel interno para ver pedidos, cambiar estados, administrar fechas, modificar cupos, consultar clientes y dejar notas.",
    price: "USD 300",
  },
  {
    name: "Pagos y automatizaciones",
    description:
      "Integración de pagos, registro de señas o pagos completos, confirmaciones, mensajes operativos y ajustes del flujo real.",
    price: "USD 200",
  },
  {
    name: "Deploy, QA y lanzamiento",
    description:
      "Puesta online, configuración de dominio, pruebas en dispositivos, ajustes finales, analítica básica y acompañamiento inicial.",
    price: "USD 150",
  },
];

const scope = [
  ["Web comercial", "Home, historia, producto, menú, preguntas frecuentes, diseño responsive y copy orientado a conversión."],
  ["Catálogo digital", "Sabores, tamaños, descripciones, precios, productos activos/inactivos y preparación para actualización desde sistema."],
  ["Pedido asistido", "Selección de sabores y cantidades, calendario, modalidad de entrega, datos del cliente, totales y reglas de pago."],
  ["Sistema interno", "Base de datos, registro de pedidos, estados, cupos diarios, fechas cerradas, notas internas y filtros operativos."],
  ["Pagos online", "Seña del 50% para retiro, pago completo para envío y registro de estado de pago."],
  ["Automatizaciones", "Confirmaciones, mensajes de seguimiento, recordatorios operativos y textos base para respuestas frecuentes."],
];

const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title></title>
    <style>
      @page {
        size: A4;
        margin: 0;
      }

      :root {
        --paper: #fbf7ee;
        --milk: #fffdf8;
        --ink: #241816;
        --muted: #74635b;
        --line: rgba(36, 24, 22, 0.14);
        --sage: #64746a;
        --sage-soft: #dfe7d9;
        --caramel: #b57946;
        --caramel-soft: #eddbc1;
        --chocolate: #3a241f;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        color: var(--ink);
        background: var(--paper);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 11px;
        line-height: 1.48;
      }

      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .page {
        background: var(--paper);
        min-height: 297mm;
        padding: 16mm;
        position: relative;
      }

      .cover {
        display: grid;
        grid-template-rows: auto 1fr auto;
        gap: 20mm;
      }

      .brand-row {
        align-items: center;
        display: flex;
        justify-content: space-between;
        gap: 16px;
      }

      .logo-lockup {
        align-items: center;
        display: flex;
        gap: 10px;
      }

      .logo-mark {
        height: 36px;
        width: 36px;
        border-radius: 10px;
        object-fit: contain;
      }

      .logo-text {
        display: grid;
        gap: 1px;
      }

      .logo-text strong {
        font-size: 13px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .logo-text span,
      .meta-pill {
        color: var(--muted);
        font-size: 9px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .meta-pill {
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 7px 10px;
      }

      .hero {
        display: grid;
        grid-template-columns: 1fr 0.78fr;
        gap: 15mm;
        align-items: end;
      }

      .eyebrow {
        color: var(--sage);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.18em;
        margin: 0 0 9px;
        text-transform: uppercase;
      }

      h1,
      h2,
      h3,
      p {
        margin: 0;
      }

      h1 {
        color: var(--chocolate);
        font-family: Georgia, "Times New Roman", serif;
        font-size: 54px;
        font-style: italic;
        font-weight: 500;
        letter-spacing: -0.055em;
        line-height: 0.9;
      }

      .subtitle {
        color: var(--muted);
        font-size: 14px;
        line-height: 1.55;
        margin-top: 14px;
        max-width: 430px;
      }

      .cover-image {
        border-radius: 22px;
        box-shadow: 0 22px 60px rgba(36, 24, 22, 0.18);
        height: 238px;
        object-fit: cover;
        width: 100%;
      }

      .price-panel {
        background: var(--chocolate);
        border-radius: 22px;
        color: var(--milk);
        display: grid;
        gap: 10px;
        margin-top: 18px;
        padding: 18px;
      }

      .price-panel span {
        color: rgba(255, 253, 248, 0.7);
        font-size: 9px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      .price-panel strong {
        font-family: Georgia, "Times New Roman", serif;
        font-size: 38px;
        font-weight: 500;
        letter-spacing: -0.04em;
        line-height: 1;
      }

      .price-panel p {
        color: rgba(255, 253, 248, 0.72);
        font-size: 10.5px;
      }

      .cover-footer {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
      }

      .fact {
        border-top: 1px solid var(--line);
        padding-top: 10px;
      }

      .fact span {
        color: var(--sage);
        display: block;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.16em;
        margin-bottom: 4px;
        text-transform: uppercase;
      }

      .fact strong {
        font-size: 12px;
      }

      .section {
        page-break-before: always;
      }

      .section-header {
        align-items: end;
        border-bottom: 1px solid var(--line);
        display: flex;
        justify-content: space-between;
        margin-bottom: 16px;
        padding-bottom: 12px;
      }

      h2 {
        color: var(--chocolate);
        font-family: Georgia, "Times New Roman", serif;
        font-size: 30px;
        font-weight: 500;
        letter-spacing: -0.035em;
        line-height: 1;
      }

      .small-label {
        color: var(--muted);
        font-size: 9px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .scope-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }

      .scope-card,
      .callout,
      .terms {
        background: rgba(255, 253, 248, 0.76);
        border: 1px solid rgba(36, 24, 22, 0.1);
        border-radius: 16px;
        padding: 14px;
      }

      .scope-card h3 {
        color: var(--chocolate);
        font-size: 12px;
        margin-bottom: 5px;
      }

      .scope-card p,
      .terms li {
        color: var(--muted);
      }

      table {
        border-collapse: collapse;
        width: 100%;
      }

      th {
        color: var(--sage);
        font-size: 9px;
        letter-spacing: 0.14em;
        padding: 10px 0;
        text-align: left;
        text-transform: uppercase;
      }

      td {
        border-top: 1px solid var(--line);
        padding: 12px 0;
        vertical-align: top;
      }

      td:first-child {
        color: var(--chocolate);
        font-weight: 750;
        width: 28%;
      }

      td:nth-child(2) {
        color: var(--muted);
        padding-right: 14px;
      }

      td:last-child {
        color: var(--chocolate);
        font-weight: 800;
        text-align: right;
        white-space: nowrap;
        width: 16%;
      }

      .summary-row {
        background: var(--caramel-soft);
        border-radius: 18px;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 18px;
        margin-top: 18px;
        padding: 18px;
      }

      .summary-row span {
        color: var(--muted);
        display: block;
        font-size: 10px;
        letter-spacing: 0.12em;
        margin-bottom: 4px;
        text-transform: uppercase;
      }

      .summary-row strong {
        color: var(--chocolate);
        font-family: Georgia, "Times New Roman", serif;
        font-size: 34px;
        font-weight: 500;
        letter-spacing: -0.035em;
        line-height: 1;
      }

      .callout {
        background: var(--sage-soft);
        margin-top: 14px;
      }

      .callout strong {
        color: var(--chocolate);
        display: block;
        font-size: 13px;
        margin-bottom: 5px;
      }

      .callout p {
        color: #4d5f55;
      }

      .two-col {
        display: grid;
        grid-template-columns: 1fr 0.85fr;
        gap: 13px;
      }

      ul {
        margin: 8px 0 0;
        padding-left: 16px;
      }

      li {
        margin: 4px 0;
      }

      .plan {
        background: var(--chocolate);
        border-radius: 18px;
        color: var(--milk);
        margin-top: 14px;
        padding: 18px;
      }

      .plan-grid {
        display: grid;
        grid-template-columns: 0.65fr 1fr;
        gap: 18px;
      }

      .plan-price span {
        color: rgba(255, 253, 248, 0.68);
        display: block;
        font-size: 9px;
        letter-spacing: 0.34em;
        margin-bottom: 6px;
        text-transform: uppercase;
      }

      .plan-price strong {
        display: block;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 42px;
        font-weight: 500;
        letter-spacing: -0.04em;
        line-height: 1;
      }

      .plan ul {
        color: rgba(255, 253, 248, 0.76);
        margin-top: 0;
      }

      .plan-note {
        border-top: 1px solid rgba(255, 253, 248, 0.16);
        color: rgba(255, 253, 248, 0.74);
        margin-top: 13px;
        padding-top: 12px;
      }

      .terms {
        margin-top: 14px;
      }
    </style>
  </head>
  <body>
    <main class="page cover">
      <header class="brand-row">
        <div class="logo-lockup">
          <img class="logo-mark" src="${logoDataUrl}" alt="Cobots" />
          <div class="logo-text">
            <strong>Cobots</strong>
            <span>Automatización + sistemas</span>
          </div>
        </div>
        <div class="meta-pill">7 de mayo de 2026</div>
      </header>

      <section class="hero">
        <div>
          <p class="eyebrow">Propuesta para Natta</p>
          <h1>Web y sistema de pedidos</h1>
          <p class="subtitle">
            Plataforma para ordenar la venta por encargo, mejorar la experiencia del cliente
            y preparar la operación para crecer sin depender solamente de mensajes manuales.
          </p>
          <div class="price-panel">
            <span>Valor especial de referencia</span>
            <strong>USD 1.250</strong>
            <p>Precio pensado para Natta por cercanía y por el potencial del proyecto como caso de estudio para Cobots.</p>
          </div>
        </div>
        <img class="cover-image" src="${heroDataUrl}" alt="Tartas Natta" />
      </section>

      <footer class="cover-footer">
        <div class="fact">
          <span>Cliente</span>
          <strong>Natta</strong>
        </div>
        <div class="fact">
          <span>Modalidad</span>
          <strong>Costo + canje</strong>
        </div>
        <div class="fact">
          <span>Luego del mes 3</span>
          <strong>USD 50 / mes</strong>
        </div>
      </footer>
    </main>

    <section class="page section">
      <header class="section-header">
        <h2>Alcance funcional</h2>
        <span class="small-label">Qué incluye</span>
      </header>

      <div class="scope-grid">
        ${scope
          .map(
            ([title, description]) => `
              <article class="scope-card">
                <h3>${title}</h3>
                <p>${description}</p>
              </article>
            `,
          )
          .join("")}
      </div>

      <div class="callout">
        <strong>Objetivo principal</strong>
        <p>
          Que Natta pueda mostrar productos, precios y reglas con claridad, recibir pedidos más completos
          y operar con una base técnica lista para cupos, pagos, backoffice y seguimiento.
        </p>
      </div>

      <header class="section-header" style="margin-top: 24px;">
        <h2>Etapas y valores</h2>
        <span class="small-label">Referencia Cobots x Natta</span>
      </header>

      <table>
        <thead>
          <tr>
            <th>Etapa</th>
            <th>Incluye</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          ${stages
            .map(
              (stage) => `
                <tr>
                  <td>${stage.name}</td>
                  <td>${stage.description}</td>
                  <td>${stage.price}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>

      <div class="summary-row">
        <div>
          <span>Total proyecto completo</span>
          <p>Valor especial de referencia. No representa tarifa estándar de mercado para un sistema de estas características.</p>
        </div>
        <strong>USD 1.250</strong>
      </div>
    </section>

    <section class="page section">
      <header class="section-header">
        <h2>Acuerdo especial</h2>
        <span class="small-label">Lanzamiento + canje</span>
      </header>

      <div class="two-col">
        <article class="scope-card">
          <h3>Bonificación aplicada</h3>
          <ul>
            <li>Desarrollo inicial bonificado por vínculo cercano y acuerdo especial de lanzamiento.</li>
            <li>Natta cubre solamente los costos externos necesarios para operar durante los primeros meses.</li>
            <li>Cobots puede usar el proyecto como caso de estudio público.</li>
            <li>La comunicación pública del caso se coordina aparte entre Natta y Cobots.</li>
          </ul>
        </article>
        <article class="scope-card">
          <h3>Costos externos</h3>
          <ul>
            <li>Dominio, si corresponde.</li>
            <li>Hosting, base de datos o servicios cloud, si superan planes gratuitos.</li>
            <li>Comisiones de la pasarela de pago.</li>
            <li>Herramientas externas de WhatsApp, email, SMS o automatización.</li>
          </ul>
        </article>
      </div>

      <div class="plan">
        <div class="plan-grid">
          <div class="plan-price">
            <span>Mantenimiento desde mes 4</span>
            <strong>USD 50</strong>
            <p>por mes</p>
          </div>
          <ul>
            <li>El costo operativo base del sistema queda incluido dentro de este mantenimiento mensual.</li>
            <li>Supervisión técnica básica, monitoreo de errores y backups.</li>
            <li>Ajustes menores de textos, precios, sabores y contenido.</li>
            <li>Soporte operativo por WhatsApp o canal acordado.</li>
            <li>Hasta 2 horas mensuales de mejoras chicas o ajustes.</li>
            <li>Revisión mensual de funcionamiento general.</li>
          </ul>
        </div>
        <p class="plan-note">
          Desde el mes 4, el costo operativo base entra dentro del mantenimiento mensual de USD 50.
        </p>
      </div>

      <div class="terms">
        <h3>Condiciones generales</h3>
        <ul>
          <li>Los valores están expresados en dólares estadounidenses como referencia. El pago puede hacerse en pesos al tipo de cambio acordado al momento de pago.</li>
          <li>Durante los primeros 3 meses posteriores al lanzamiento, Natta paga solamente los costos externos de operación.</li>
          <li>Desde el mes 4, el costo operativo base queda incluido dentro del mantenimiento mensual.</li>
          <li>El presupuesto tiene una validez de 15 días.</li>
          <li>Los tiempos de entrega dependen de la entrega de fotos, textos, datos reales de productos y definiciones operativas.</li>
          <li>Cambios de alcance o funcionalidades nuevas se presupuestan por separado.</li>
        </ul>
      </div>
    </section>
  </body>
</html>`;

await fs.mkdir(outputDir, { recursive: true });

const htmlPath = path.join(outputDir, "presupuesto-natta.html");
const pdfPath = path.join(outputDir, "presupuesto-natta.pdf");

await fs.writeFile(htmlPath, html, "utf8");
await fs.copyFile(
  path.join(projectRoot, "docs/presupuesto-natta.md"),
  path.join(outputDir, "presupuesto-natta.md"),
);
await fs.copyFile(
  path.join(projectRoot, "docs/mensaje-presupuesto-natta.md"),
  path.join(outputDir, "mensaje-para-enviar.md"),
);
await fs.rm(pdfPath, { force: true });

try {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
  await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await browser.close();
} catch {
  const chromePath =
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const userDataDir = path.join(
    "/private/tmp",
    `cobots-pdf-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );

  await fs.mkdir(userDataDir, { recursive: true });
  try {
    await execFileAsync(
      chromePath,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--no-pdf-header-footer",
        "--print-to-pdf-no-header",
        `--user-data-dir=${userDataDir}`,
        `--print-to-pdf=${pdfPath}`,
        `file://${htmlPath}`,
      ],
      { timeout: 15000 },
    );
  } catch (chromeError) {
    const pdfStats = await fs.stat(pdfPath).catch(() => null);

    if (!pdfStats?.size) {
      throw chromeError;
    }
  } finally {
    await fs.rm(userDataDir, { force: true, recursive: true });
  }
}

console.log(JSON.stringify({ htmlPath, pdfPath }, null, 2));
