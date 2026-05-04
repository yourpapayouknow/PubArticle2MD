const ui = {
  urlInput: document.getElementById("urlInput"),
  sourceUrlInput: document.getElementById("sourceUrlInput"),
  htmlInput: document.getElementById("htmlInput"),
  parseBtn: document.getElementById("parseBtn"),
  mdBtn: document.getElementById("mdBtn"),
  pdfBtn: document.getElementById("pdfBtn"),
  status: document.getElementById("status"),
  meta: document.getElementById("meta"),
  preview: document.getElementById("preview")
};

let lastPayload = null;

function setBusy(busy) {
  [ui.parseBtn, ui.mdBtn, ui.pdfBtn].forEach((button) => {
    button.disabled = busy;
  });
}

function setStatus(message, isError = false) {
  ui.status.textContent = message || "";
  ui.status.classList.toggle("error", isError);
}

function buildPayload() {
  const html = ui.htmlInput.value.trim();
  if (html) {
    return {
      html,
      sourceUrl: ui.sourceUrlInput.value.trim() || ui.urlInput.value.trim() || "https://mp.weixin.qq.com/"
    };
  }

  const url = ui.urlInput.value.trim();
  if (!url) {
    throw new Error("Please provide a WeChat URL.");
  }

  return { url };
}

function sanitizePreviewHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html || "";
  template.content
    .querySelectorAll("script, style, iframe, object, embed, form, button, input, textarea")
    .forEach((node) => node.remove());
  return template.innerHTML;
}

function renderMeta(article) {
  const cells = [
    ["Title", article.title || "-"],
    ["Author", article.author || "-"],
    ["Publish", article.publishTime || "-"],
    ["Images", String(article.imageUrls?.length || 0)]
  ];

  ui.meta.innerHTML = cells
    .map(([k, v]) => `<span><strong>${k}:</strong> ${String(v)}</span>`)
    .join("");
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
  setTimeout(() => URL.revokeObjectURL(url), 2000);
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
    setStatus("Parsing article...");

    const payload = buildPayload();
    const data = await postJson("/api/parse", payload);

    lastPayload = payload;

    renderMeta(data.article);
    ui.preview.innerHTML = sanitizePreviewHtml(data.article.contentHtml || "");
    setStatus("Article parsed. You can export Markdown ZIP or PDF now.");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setBusy(false);
  }
}

async function exportMarkdownZip() {
  try {
    setBusy(true);
    setStatus("Generating Markdown ZIP...");

    const payload = lastPayload || buildPayload();
    const { blob, disposition } = await postBlob("/api/export/markdown", payload);

    const fileName = fileNameFromDisposition(disposition, "article.zip");
    downloadBlob(blob, fileName);
    setStatus(`Done: ${fileName}`);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setBusy(false);
  }
}

async function exportPdf() {
  try {
    setBusy(true);
    setStatus("Generating PDF with local Chromium...");

    const payload = lastPayload || buildPayload();
    const { blob, disposition } = await postBlob("/api/export/pdf", payload);

    const fileName = fileNameFromDisposition(disposition, "article.pdf");
    downloadBlob(blob, fileName);
    setStatus(`Done: ${fileName}`);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setBusy(false);
  }
}

ui.parseBtn.addEventListener("click", parseArticle);
ui.mdBtn.addEventListener("click", exportMarkdownZip);
ui.pdfBtn.addEventListener("click", exportPdf);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Ignore registration failures in unsupported environments.
    });
  });
}
