function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderArticleDocument(article, contentHtml) {
  const title = escapeHtml(article.title || "Untitled");
  const author = escapeHtml(article.author || "Unknown");
  const publishTime = escapeHtml(article.publishTime || "");
  const sourceUrl = escapeHtml(article.sourceUrl || "");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root {
      color-scheme: light;
      --text: #181818;
      --muted: #656565;
      --bg: #ffffff;
      --border: #e9e9e9;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      color: var(--text);
      background: var(--bg);
      line-height: 1.72;
      font-size: 16px;
      padding: 28px 24px 40px;
    }

    article {
      max-width: 860px;
      margin: 0 auto;
    }

    header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 14px;
      margin-bottom: 24px;
    }

    h1 {
      font-size: 2rem;
      line-height: 1.35;
      margin: 0 0 12px;
    }

    .meta {
      color: var(--muted);
      font-size: 0.92rem;
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
    }

    .meta span::before {
      content: "";
      display: inline-block;
      width: 4px;
      height: 4px;
      border-radius: 999px;
      background: #b0b0b0;
      margin-right: 8px;
      vertical-align: middle;
    }

    .meta span:first-child::before {
      display: none;
      margin-right: 0;
      width: 0;
    }

    .content img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 14px auto;
    }

    .content video,
    .content iframe {
      max-width: 100%;
    }

    .content pre {
      overflow-x: auto;
      white-space: pre-wrap;
      background: #f7f7f7;
      border-radius: 8px;
      padding: 12px;
    }

    .content table {
      border-collapse: collapse;
      width: 100%;
      margin: 16px 0;
      font-size: 0.95rem;
    }

    .content th,
    .content td {
      border: 1px solid var(--border);
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }

    .content blockquote {
      margin: 14px 0;
      padding: 8px 12px;
      border-left: 3px solid #cbcbcb;
      color: #4b4b4b;
      background: #fafafa;
    }

    footer {
      margin-top: 28px;
      color: #9a9a9a;
      font-size: 0.85rem;
      border-top: 1px solid var(--border);
      padding-top: 10px;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <article>
    <header>
      <h1>${title}</h1>
      <div class="meta">
        <span>${author}</span>
        ${publishTime ? `<span>${publishTime}</span>` : ""}
      </div>
    </header>

    <section class="content">
      ${contentHtml || ""}
    </section>

    <footer>Source: ${sourceUrl}</footer>
  </article>
</body>
</html>`;
}

module.exports = {
  renderArticleDocument
};
