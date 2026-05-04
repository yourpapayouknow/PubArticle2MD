const fs = require("node:fs/promises");
const path = require("node:path");

const { fetchWechatArticle, extractArticleFromHtml } = require("../server/lib/wechat");
const { safeBaseName, renderMarkdown, buildMarkdownZip } = require("../server/lib/markdown");
const { generatePdfBuffer } = require("../server/lib/pdf");

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = argv[i + 1];

    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    i += 1;
  }

  return args;
}

async function loadArticle(args) {
  if (args.url) {
    return fetchWechatArticle(args.url);
  }

  if (args.html) {
    const htmlPath = path.resolve(args.html);
    const html = await fs.readFile(htmlPath, "utf8");
    const sourceUrl = args.source || "https://mp.weixin.qq.com/";
    return extractArticleFromHtml(html, sourceUrl);
  }

  throw new Error("Usage: node scripts/convert-cli.js --url <wechat-url> [--outdir outputs]");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(args.outdir || "outputs");

  await fs.mkdir(outDir, { recursive: true });

  const article = await loadArticle(args);
  const baseName = safeBaseName(article.title);

  const shouldWriteMd = args["no-md"] !== true;
  const shouldWriteZip = args["no-zip"] !== true;
  const shouldWritePdf = args["no-pdf"] !== true;

  if (shouldWriteMd) {
    const markdown = renderMarkdown(article);
    const mdPath = path.join(outDir, `${baseName}.md`);
    await fs.writeFile(mdPath, markdown, "utf8");
    console.log(`Markdown: ${mdPath}`);
  }

  if (shouldWriteZip) {
    const zip = await buildMarkdownZip(article);
    const zipPath = path.join(outDir, zip.zipFileName);
    await fs.writeFile(zipPath, zip.zipBuffer);
    console.log(`Markdown ZIP: ${zipPath}`);
    if (zip.warnings.length > 0) {
      console.log(`ZIP warnings: ${zip.warnings.length}`);
    }
  }

  if (shouldWritePdf) {
    const pdf = await generatePdfBuffer(article);
    const pdfPath = path.join(outDir, `${baseName}.pdf`);
    await fs.writeFile(pdfPath, pdf.pdf);
    console.log(`PDF: ${pdfPath}`);
    if (pdf.warnings.length > 0) {
      console.log(`PDF warnings: ${pdf.warnings.length}`);
    }
  }
}

main().catch((error) => {
  console.error(`[convert-cli] ${error.message}`);
  process.exitCode = 1;
});
