const path = require("node:path");

const express = require("express");

const { fetchWechatArticle, extractArticleFromHtml } = require("./lib/wechat");
const { safeBaseName, renderMarkdown, buildMarkdownZip } = require("./lib/markdown");
const { generatePdfBuffer } = require("./lib/pdf");

function contentDispositionAttachment(fileName) {
  const fallback = fileName.replace(/[^\x20-\x7E]+/g, "_");
  return `attachment; filename=\"${fallback}\"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

async function resolveArticleInput(body) {
  if (body && typeof body.url === "string" && body.url.trim()) {
    return fetchWechatArticle(body.url.trim());
  }

  if (body && typeof body.html === "string" && body.html.trim()) {
    const sourceUrl = typeof body.sourceUrl === "string" && body.sourceUrl.trim()
      ? body.sourceUrl.trim()
      : "https://mp.weixin.qq.com/";

    return extractArticleFromHtml(body.html, sourceUrl);
  }

  throw new Error("Please provide a WeChat article URL or raw HTML.");
}

function createApp() {
  const app = express();

  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: false, limit: "25mb" }));
  app.use(express.static(path.join(__dirname, "..", "public"), { maxAge: "1h" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      service: "pubarticle2md-pwa",
      runtime: process.env.PUBARTICLE_RUNTIME || "node"
    });
  });

  app.post("/api/parse", async (req, res) => {
    try {
      const article = await resolveArticleInput(req.body || {});
      const markdown = renderMarkdown(article);

      res.json({
        ok: true,
        article,
        markdown
      });
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: error.message
      });
    }
  });

  app.post("/api/export/markdown", async (req, res) => {
    try {
      const article = await resolveArticleInput(req.body || {});
      const withAssets = req.body?.withAssets !== false;
      const baseName = safeBaseName(article.title);

      if (!withAssets) {
        const markdown = renderMarkdown(article);
        res.setHeader("Content-Type", "text/markdown; charset=utf-8");
        res.setHeader("Content-Disposition", contentDispositionAttachment(`${baseName}.md`));
        res.send(markdown);
        return;
      }

      const result = await buildMarkdownZip(article);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", contentDispositionAttachment(result.zipFileName));
      res.setHeader("X-Image-Count", String(result.imageCount));
      if (result.warnings.length > 0) {
        res.setHeader("X-Export-Warnings", String(result.warnings.length));
      }

      res.send(result.zipBuffer);
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: error.message
      });
    }
  });

  app.post("/api/export/pdf", async (req, res) => {
    try {
      const article = await resolveArticleInput(req.body || {});
      const baseName = safeBaseName(article.title);
      const result = await generatePdfBuffer(article);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", contentDispositionAttachment(`${baseName}.pdf`));
      if (result.warnings.length > 0) {
        res.setHeader("X-Export-Warnings", String(result.warnings.length));
      }

      res.send(result.pdf);
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: error.message
      });
    }
  });

  app.use((_req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
  });

  return app;
}

async function startServer(options = {}) {
  const host = options.host || process.env.HOST || "127.0.0.1";
  const envPort = process.env.PORT ? Number(process.env.PORT) : undefined;
  const port = options.port ?? envPort ?? 8787;

  const app = createApp();

  return new Promise((resolve, reject) => {
    const server = app
      .listen(port, host, () => {
        const address = server.address();
        const resolvedPort = typeof address === "object" && address ? address.port : port;
        const url = `http://${host}:${resolvedPort}`;
        resolve({ app, server, host, port: resolvedPort, url });
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

if (require.main === module) {
  startServer()
    .then(({ url }) => {
      console.log(`PubArticle2MD running at ${url}`);
    })
    .catch((error) => {
      console.error(`[server] Failed to start: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = {
  createApp,
  startServer
};
