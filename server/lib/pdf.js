const cheerio = require("cheerio");
const { chromium } = require("playwright");

const { fetchBuffer } = require("./http");
const { renderArticleDocument } = require("./templates");

function contentTypeToExtension(contentType) {
  const value = (contentType || "").toLowerCase();
  if (value.includes("png")) return "png";
  if (value.includes("jpeg") || value.includes("jpg")) return "jpeg";
  if (value.includes("gif")) return "gif";
  if (value.includes("webp")) return "webp";
  if (value.includes("svg")) return "svg+xml";
  return "octet-stream";
}

async function embedImagesAsDataUris(contentHtml, sourceUrl) {
  const $$ = cheerio.load(`<div id=\"root\">${contentHtml || ""}</div>`, { decodeEntities: true });
  const $root = $$("#root");

  const warnings = [];
  const nodes = $root.find("img").toArray();

  for (const node of nodes) {
    const $img = $$(node);
    const src = ($img.attr("src") || "").trim();

    if (!/^https?:\/\//i.test(src)) {
      continue;
    }

    try {
      const { buffer, contentType } = await fetchBuffer(src, {
        referer: sourceUrl
      });
      const mime = contentType || `image/${contentTypeToExtension(contentType)}`;
      const b64 = buffer.toString("base64");
      $img.attr("src", `data:${mime};base64,${b64}`);
    } catch (error) {
      warnings.push(`Image embed failed: ${src} (${error.message})`);
    }
  }

  return {
    html: $root.html() || "",
    warnings
  };
}

async function generatePdfBuffer(article) {
  const { html: inlinedHtml, warnings } = await embedImagesAsDataUris(article.contentHtml, article.sourceUrl);
  const documentHtml = renderArticleDocument(article, inlinedHtml);

  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 1600 }
    });

    await page.setContent(documentHtml, {
      waitUntil: "networkidle",
      timeout: 120000
    });

    await page.emulateMedia({ media: "screen" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "12mm",
        right: "10mm",
        bottom: "12mm",
        left: "10mm"
      }
    });

    return {
      pdf,
      warnings
    };
  } finally {
    await browser.close();
  }
}

module.exports = {
  generatePdfBuffer
};
