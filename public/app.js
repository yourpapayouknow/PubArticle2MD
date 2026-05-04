const ui = {
  runtimeMode: document.getElementById("runtimeMode"),
  fetchMode: document.getElementById("fetchMode"),
  proxyTemplate: document.getElementById("proxyTemplate"),
  urlInput: document.getElementById("urlInput"),
  sourceUrlInput: document.getElementById("sourceUrlInput"),
  htmlInput: document.getElementById("htmlInput"),
  parseBtn: document.getElementById("parseBtn"),
  mdBtn: document.getElementById("mdBtn"),
  pdfBtn: document.getElementById("pdfBtn"),
  status: document.getElementById("status"),
  meta: document.getElementById("meta"),
  preview: document.getElementById("preview"),
  proxyBox: document.getElementById("proxyBox"),
  htmlBox: document.getElementById("htmlBox")
};

const state = {
  apiAvailable: false,
  runtime: "detecting",
  lastArticle: null,
  lastPayload: null,
  lastMode: "auto"
};

function setBusy(busy) {
  [ui.parseBtn, ui.mdBtn, ui.pdfBtn, ui.fetchMode].forEach((button) => {
    button.disabled = busy;
  });
}

function setStatus(message, isError = false) {
  ui.status.textContent = message || "";
  ui.status.classList.toggle("error", isError);
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeFileBaseName(title) {
  const raw = (title || "wechat-article").trim();
  const cleaned = raw.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ");
  const normalized = cleaned.slice(0, 80).trim();
  return normalized || "wechat-article";
}

function fileNameFromDisposition(disposition, fallbackName) {
  if (!disposition) return fallbackName;
  const starMatch = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (starMatch) {
    return decodeURIComponent(starMatch[1]);
  }
  const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
  if (!match) return fallbackName;
  return decodeURIComponent(match[1]);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function normalizeAbsoluteUrl(rawValue, sourceUrl) {
  if (!rawValue) return "";
  const input = rawValue.trim();
  if (!input) return "";
  if (input.startsWith("data:")) return input;

  const candidate = input.startsWith("//") ? `https:${input}` : input;
  try {
    return new URL(candidate, sourceUrl || "https://mp.weixin.qq.com/").toString();
  } catch {
    return "";
  }
}

function sanitizePreviewHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html || "";
  template.content
    .querySelectorAll("script, style, iframe, object, embed, form, button, input, textarea")
    .forEach((node) => node.remove());

  template.content.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      if (attr.name.toLowerCase().startsWith("on")) {
        el.removeAttribute(attr.name);
      }
    }
  });

  return template.innerHTML;
}

function renderMeta(article) {
  const cells = [
    ["标题", article.title || "-"],
    ["作者", article.author || "-"],
    ["发布时间", article.publishTime || "-"],
    ["图片", String(article.imageUrls?.length || 0)],
    ["来源模式", article.sourceType || "-"]
  ];

  ui.meta.innerHTML = cells
    .map(([k, v]) => `<span><strong>${k}:</strong> ${escapeHtml(String(v))}</span>`)
    .join("");
}

function guessContentHtmlFromMarkdown(markdown) {
  if (window.marked?.parse) {
    return window.marked.parse(markdown || "");
  }

  return `<pre>${escapeHtml(markdown || "")}</pre>`;
}

function extractArticleFromHtml(html, sourceUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const title =
    doc.querySelector("#activity-name")?.textContent?.trim() ||
    doc.querySelector("h1")?.textContent?.trim() ||
    "wechat-article";

  const author =
    doc.querySelector("#js_name")?.textContent?.trim() ||
    doc.querySelector(".rich_media_meta_nickname")?.textContent?.trim() ||
    doc.querySelector(".profile_nickname")?.textContent?.trim() ||
    "Unknown";

  const publishTime =
    doc.querySelector("#publish_time")?.textContent?.trim() ||
    "";

  const contentNode = doc.querySelector("#js_content") || doc.querySelector(".rich_media_content");
  if (!contentNode) {
    throw new Error("未找到正文节点（#js_content）。可尝试粘贴完整 HTML。\n");
  }

  const clone = contentNode.cloneNode(true);
  clone.querySelectorAll("script, style, iframe, form, button, input, textarea, source").forEach((node) => node.remove());

  const imageUrls = [];
  clone.querySelectorAll("img").forEach((img) => {
    const srcCandidate =
      img.getAttribute("data-src") ||
      img.getAttribute("data-original") ||
      img.getAttribute("src") ||
      img.getAttribute("data-actualsrc") ||
      "";

    const normalized = normalizeAbsoluteUrl(srcCandidate, sourceUrl);

    if (normalized) {
      img.setAttribute("src", normalized);
      imageUrls.push(normalized);
    } else {
      img.removeAttribute("src");
    }

    img.removeAttribute("data-src");
    img.removeAttribute("data-original");
    img.removeAttribute("data-actualsrc");
    img.removeAttribute("srcset");
  });

  clone.querySelectorAll("a[href]").forEach((a) => {
    const href = normalizeAbsoluteUrl(a.getAttribute("href") || "", sourceUrl);
    if (href) {
      a.setAttribute("href", href);
    }
  });

  return {
    title,
    author,
    publishTime,
    sourceUrl,
    sourceType: "html",
    contentHtml: clone.innerHTML,
    imageUrls: [...new Set(imageUrls)]
  };
}

function extractArticleFromReaderText(text, sourceUrl) {
  const content = String(text || "").trim();
  if (!content) {
    throw new Error("代理返回为空。");
  }

  if (content.includes("环境异常") && content.includes("去验证")) {
    throw new Error("代理返回了微信验证页，请改用“粘贴 HTML”模式。");
  }

  const titleMatch = content.match(/^Title:\s*(.+)$/m);
  const title = titleMatch?.[1]?.trim() || "wechat-article";

  const marker = "Markdown Content:";
  const rawMarkdown = content.includes(marker)
    ? content.slice(content.indexOf(marker) + marker.length).trim()
    : content;

  return {
    title,
    author: "Unknown",
    publishTime: "",
    sourceUrl,
    sourceType: "markdown-proxy",
    rawMarkdown,
    contentHtml: guessContentHtmlFromMarkdown(rawMarkdown),
    imageUrls: []
  };
}

function buildProxyUrl(template, url) {
  const encoded = encodeURIComponent(url);

  if (template.includes("{url}") || template.includes("{url_encoded}") || template.includes("{url-encoded}")) {
    return template
      .replaceAll("{url}", url)
      .replaceAll("{url_encoded}", encoded)
      .replaceAll("{url-encoded}", encoded);
  }

  return `${template}${url}`;
}

async function fetchTextViaProxy(url, template) {
  const finalUrl = buildProxyUrl(template, url);
  const response = await fetch(finalUrl);

  if (!response.ok) {
    throw new Error(`代理请求失败 (${response.status})`);
  }

  return {
    text: await response.text(),
    contentType: response.headers.get("content-type") || ""
  };
}

function getTurndownService() {
  if (!window.TurndownService) {
    throw new Error("Turndown 组件未加载。");
  }

  const td = new window.TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-"
  });

  if (window.turndownPluginGfm?.gfm) {
    td.use(window.turndownPluginGfm.gfm);
  }

  td.addRule("lineBreak", {
    filter: "br",
    replacement: () => "  \n"
  });

  return td;
}

function buildFrontMatter(article) {
  const lines = [
    "---",
    `title: ${JSON.stringify(article.title || "")}`,
    `author: ${JSON.stringify(article.author || "")}`,
    `publish_time: ${JSON.stringify(article.publishTime || "")}`,
    `source: ${JSON.stringify(article.sourceUrl || "")}`,
    `mode: ${JSON.stringify(article.sourceType || "")}`,
    `generated_at: ${JSON.stringify(new Date().toISOString())}`,
    "---",
    ""
  ];

  return lines.join("\n");
}

function markdownFromArticle(article, htmlOverride) {
  const frontMatter = buildFrontMatter(article);

  if (article.rawMarkdown) {
    return `${frontMatter}${article.rawMarkdown.trim()}\n`;
  }

  const td = getTurndownService();
  const markdownBody = td.turndown(htmlOverride || article.contentHtml || "").trim();
  return `${frontMatter}${markdownBody}\n`;
}

function extensionFromUrl(url) {
  try {
    const ext = new URL(url).pathname.split(".").pop()?.toLowerCase() || "img";
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
      return ext;
    }
  } catch {
    // ignore
  }
  return "img";
}

async function buildMarkdownZipInBrowser(article) {
  if (!window.JSZip) {
    throw new Error("JSZip 组件未加载。");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<article>${article.contentHtml || ""}</article>`, "text/html");
  const root = doc.querySelector("article");

  const zip = new window.JSZip();
  const assets = zip.folder("assets");
  const warnings = [];

  const images = [...root.querySelectorAll("img")];
  let index = 0;

  for (const img of images) {
    const src = img.getAttribute("src") || "";
    if (!/^https?:\/\//i.test(src)) {
      continue;
    }

    index += 1;
    const ext = extensionFromUrl(src);
    const name = `image-${String(index).padStart(3, "0")}.${ext}`;

    try {
      const response = await fetch(src);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      assets.file(name, blob);
      img.setAttribute("src", `assets/${name}`);
    } catch (error) {
      warnings.push(`图片下载失败: ${src}`);
    }
  }

  const markdown = markdownFromArticle(article, root.innerHTML);
  const baseName = safeFileBaseName(article.title);
  zip.file(`${baseName}.md`, markdown);

  const zipBlob = await zip.generateAsync({ type: "blob" });
  return { zipBlob, fileName: `${baseName}.zip`, warnings };
}

function buildPdfElement(article) {
  const wrapper = document.createElement("article");
  wrapper.style.maxWidth = "860px";
  wrapper.style.margin = "0 auto";
  wrapper.style.padding = "12px";
  wrapper.style.fontFamily = "-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif";
  wrapper.style.lineHeight = "1.7";
  wrapper.style.color = "#1c1f1f";

  wrapper.innerHTML = `
    <header style="border-bottom:1px solid #e7e7e7;padding-bottom:10px;margin-bottom:16px;">
      <h1 style="margin:0 0 8px;font-size:28px;line-height:1.3;">${escapeHtml(article.title || "")}</h1>
      <div style="color:#5f6666;font-size:14px;">${escapeHtml(article.author || "Unknown")} ${article.publishTime ? `| ${escapeHtml(article.publishTime)}` : ""}</div>
    </header>
    <section>${sanitizePreviewHtml(article.contentHtml || "")}</section>
    <footer style="margin-top:16px;border-top:1px solid #efefef;color:#8a8a8a;font-size:12px;padding-top:8px;word-break:break-all;">Source: ${escapeHtml(article.sourceUrl || "")}</footer>
  `;

  wrapper.querySelectorAll("img").forEach((img) => {
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    img.style.display = "block";
    img.style.margin = "10px auto";
  });

  return wrapper;
}

async function detectApiAvailability() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2800);

  try {
    const response = await fetch("./api/health", {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json().catch(() => null);
    return Boolean(data && data.ok);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function updateRuntimeLabel() {
  if (state.apiAvailable) {
    state.runtime = "api";
    ui.runtimeMode.value = "本地 API 模式（高保真，支持后端 PDF）";
  } else {
    state.runtime = "static";
    ui.runtimeMode.value = "纯前端模式（GitHub Pages，可直接在线运行）";
  }
}

function resolveFetchMode() {
  const selected = ui.fetchMode.value;
  const htmlProvided = Boolean(ui.htmlInput.value.trim());

  if (selected === "auto") {
    if (htmlProvided) {
      return "html";
    }
    return state.apiAvailable ? "api" : "proxy";
  }

  return selected;
}

function updateModeHints() {
  const mode = resolveFetchMode();
  ui.proxyBox.open = mode === "proxy";
  ui.htmlBox.open = mode === "html";
}

async function postJson(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Request failed (${response.status}).`);
  }

  return data;
}

async function postBlob(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${response.status}).`);
  }

  return {
    blob: await response.blob(),
    disposition: response.headers.get("content-disposition")
  };
}

async function parseArticle() {
  try {
    setBusy(true);
    setStatus("正在解析...");

    const mode = resolveFetchMode();
    const url = ui.urlInput.value.trim();
    const html = ui.htmlInput.value.trim();

    let article;

    if (mode === "api") {
      if (!state.apiAvailable) {
        throw new Error("当前环境没有本地 API 服务，请切换为“代理”或“粘贴 HTML”模式。");
      }

      const payload = html
        ? { html, sourceUrl: ui.sourceUrlInput.value.trim() || url || "https://mp.weixin.qq.com/" }
        : { url };

      const data = await postJson("./api/parse", payload);
      article = {
        ...data.article,
        sourceType: "api"
      };
      state.lastPayload = payload;
    } else if (mode === "html") {
      if (!html) {
        throw new Error("请先粘贴 HTML。\n");
      }

      const sourceUrl = ui.sourceUrlInput.value.trim() || url || "https://mp.weixin.qq.com/";
      article = extractArticleFromHtml(html, sourceUrl);
      state.lastPayload = null;
    } else if (mode === "proxy") {
      if (!url) {
        throw new Error("请先输入文章 URL。\n");
      }

      const template = ui.proxyTemplate.value.trim();
      if (!template) {
        throw new Error("请先填写代理模板。\n");
      }

      const { text, contentType } = await fetchTextViaProxy(url, template);

      if (contentType.includes("text/html") || /<html[\s>]/i.test(text)) {
        article = extractArticleFromHtml(text, url);
        article.sourceType = "proxy-html";
      } else {
        article = extractArticleFromReaderText(text, url);
      }

      state.lastPayload = null;
    } else {
      throw new Error(`不支持的抓取方式: ${mode}`);
    }

    state.lastArticle = article;
    state.lastMode = mode;

    renderMeta(article);
    ui.preview.innerHTML = sanitizePreviewHtml(article.contentHtml || "");

    setStatus("解析完成，可下载 Markdown ZIP 或 PDF。\n");
  } catch (error) {
    setStatus(error.message || "解析失败", true);
  } finally {
    setBusy(false);
  }
}

async function exportMarkdownZip() {
  try {
    setBusy(true);

    if (state.lastMode === "api" && state.lastPayload && state.apiAvailable) {
      setStatus("后端生成 Markdown ZIP 中...");
      const { blob, disposition } = await postBlob("./api/export/markdown", state.lastPayload);
      const fileName = fileNameFromDisposition(disposition, "article.zip");
      downloadBlob(blob, fileName);
      setStatus(`已下载: ${fileName}`);
      return;
    }

    if (!state.lastArticle) {
      throw new Error("请先解析文章。\n");
    }

    setStatus("前端生成 Markdown ZIP 中...");
    const { zipBlob, fileName, warnings } = await buildMarkdownZipInBrowser(state.lastArticle);
    downloadBlob(zipBlob, fileName);

    if (warnings.length > 0) {
      setStatus(`已下载: ${fileName}（${warnings.length} 张图片跨域下载失败，已保留原链接）`);
    } else {
      setStatus(`已下载: ${fileName}`);
    }
  } catch (error) {
    setStatus(error.message || "导出失败", true);
  } finally {
    setBusy(false);
  }
}

async function exportPdf() {
  try {
    setBusy(true);

    if (state.lastMode === "api" && state.lastPayload && state.apiAvailable) {
      setStatus("后端生成 PDF 中...");
      const { blob, disposition } = await postBlob("./api/export/pdf", state.lastPayload);
      const fileName = fileNameFromDisposition(disposition, "article.pdf");
      downloadBlob(blob, fileName);
      setStatus(`已下载: ${fileName}`);
      return;
    }

    if (!state.lastArticle) {
      throw new Error("请先解析文章。\n");
    }

    if (!window.html2pdf) {
      throw new Error("html2pdf 组件未加载。\n");
    }

    setStatus("前端渲染 PDF 中...");

    const element = buildPdfElement(state.lastArticle);
    document.body.appendChild(element);

    const fileName = `${safeFileBaseName(state.lastArticle.title)}.pdf`;

    try {
      await window.html2pdf()
        .set({
          margin: [8, 8, 8, 8],
          filename: fileName,
          image: { type: "jpeg", quality: 0.96 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"] }
        })
        .from(element)
        .save();
    } finally {
      element.remove();
    }

    setStatus(`已下载: ${fileName}`);
  } catch (error) {
    setStatus(error.message || "导出失败", true);
  } finally {
    setBusy(false);
  }
}

async function initRuntime() {
  state.apiAvailable = await detectApiAvailability();
  updateRuntimeLabel();
  updateModeHints();
}

ui.fetchMode.addEventListener("change", updateModeHints);
ui.parseBtn.addEventListener("click", parseArticle);
ui.mdBtn.addEventListener("click", exportMarkdownZip);
ui.pdfBtn.addEventListener("click", exportPdf);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Ignore registration failures in unsupported environments.
    });
  });
}

initRuntime();
