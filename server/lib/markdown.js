const path = require("node:path");

const cheerio = require("cheerio");
const JSZip = require("jszip");
const sanitizeFilename = require("sanitize-filename");
const TurndownService = require("turndown");
const { gfm } = require("turndown-plugin-gfm");

const { fetchBuffer } = require("./http");

function safeBaseName(title) {
  const base = sanitizeFilename(title || "wechat-article").trim();
  if (!base) {
    return "wechat-article";
  }
  return base.toLowerCase();
}

function getMarkdownService() {
  const service = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "_"
  });

  service.use(gfm);

  service.addRule("lineBreaks", {
    filter: "br",
    replacement: () => "  \n"
  });

  return service;
}

function buildFrontMatter(article) {
  const generatedAt = new Date().toISOString();

  return [
    "---",
    `title: ${JSON.stringify(article.title || "")}`,
    `author: ${JSON.stringify(article.author || "")}`,
    `publish_time: ${JSON.stringify(article.publishTime || "")}`,
    `source: ${JSON.stringify(article.sourceUrl || "")}`,
    `generated_at: ${JSON.stringify(generatedAt)}`,
    "---",
    ""
  ].join("\n");
}

function renderMarkdown(article, htmlOverride) {
  const service = getMarkdownService();
  const html = htmlOverride ?? article.contentHtml;
  const markdownBody = service.turndown(html || "").trim();
  const frontMatter = buildFrontMatter(article);
  return `${frontMatter}${markdownBody}\n`;
}

function extensionFromType(contentType, fallbackUrl) {
  const cleanType = (contentType || "").toLowerCase();
  if (cleanType.includes("png")) return ".png";
  if (cleanType.includes("jpeg") || cleanType.includes("jpg")) return ".jpg";
  if (cleanType.includes("gif")) return ".gif";
  if (cleanType.includes("webp")) return ".webp";
  if (cleanType.includes("svg")) return ".svg";

  try {
    const parsed = new URL(fallbackUrl);
    const ext = path.extname(parsed.pathname).toLowerCase();
    if (ext && ext.length <= 5) {
      return ext;
    }
  } catch {
    // no-op
  }

  return ".img";
}

async function buildMarkdownZip(article) {
  const $$ = cheerio.load(`<article id=\"root\">${article.contentHtml || ""}</article>`, {
    decodeEntities: true
  });
  const $root = $$("#root");

  const zip = new JSZip();
  const assetFolder = zip.folder("assets");
  const warnings = [];

  let imageIndex = 0;
  const imageTags = $root.find("img").toArray();

  for (const node of imageTags) {
    const $img = $$(node);
    const src = ($img.attr("src") || "").trim();

    if (!src || !/^https?:\/\//i.test(src)) {
      continue;
    }

    imageIndex += 1;

    try {
      const { buffer, contentType } = await fetchBuffer(src, {
        referer: article.sourceUrl
      });
      const ext = extensionFromType(contentType, src);
      const fileName = `image-${String(imageIndex).padStart(3, "0")}${ext}`;
      assetFolder.file(fileName, buffer);
      $img.attr("src", `assets/${fileName}`);
    } catch (error) {
      warnings.push(`Image ${imageIndex} failed: ${src} (${error.message})`);
    }
  }

  const markdown = renderMarkdown(article, $root.html() || "");
  const baseName = safeBaseName(article.title);

  zip.file(`${baseName}.md`, markdown);

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  return {
    zipBuffer,
    markdown,
    markdownFileName: `${baseName}.md`,
    zipFileName: `${baseName}.zip`,
    imageCount: imageIndex,
    warnings
  };
}

module.exports = {
  safeBaseName,
  renderMarkdown,
  buildMarkdownZip
};
