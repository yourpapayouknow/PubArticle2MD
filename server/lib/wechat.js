const cheerio = require("cheerio");

const { fetchText } = require("./http");

const WECHAT_HOST = "mp.weixin.qq.com";

function normalizeInputUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error("URL is required.");
  }

  const normalized = rawUrl.trim();
  const parsed = new URL(normalized);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP/HTTPS URLs are supported.");
  }

  parsed.hash = "";

  return parsed.toString();
}

function assertWechatArticleUrl(url) {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();

  if (host !== WECHAT_HOST) {
    throw new Error(`Only ${WECHAT_HOST} article links are supported.`);
  }

  const validPath = parsed.pathname.startsWith("/s") || parsed.pathname.startsWith("/mp/appmsg");
  if (!validPath) {
    throw new Error("This URL does not look like a WeChat article page.");
  }
}

function normalizeAbsoluteUrl(rawValue) {
  if (!rawValue) {
    return null;
  }

  const value = rawValue.trim();
  if (!value) {
    return null;
  }

  if (value.startsWith("data:")) {
    return value;
  }

  const withProtocol = value.startsWith("//") ? `https:${value}` : value;

  try {
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
}

function hasCaptchaWall(text, finalUrl) {
  const urlHit = typeof finalUrl === "string" && finalUrl.includes("wappoc_appmsgcaptcha");
  const markers = [
    "环境异常",
    "完成验证后即可继续访问",
    "去验证",
    "wappoc_appmsgcaptcha"
  ];

  const textHit = markers.some((marker) => text.includes(marker));
  return urlHit || textHit;
}

function firstText($, selectors) {
  for (const selector of selectors) {
    const value = $(selector).first().text().trim();
    if (value) {
      return value;
    }
  }
  return "";
}

function extractArticleFromHtml(html, sourceUrl) {
  const $ = cheerio.load(html, { decodeEntities: true });

  const title = firstText($, ["#activity-name", "h1", "meta[property='og:title']"]);
  const author = firstText($, ["#js_name", ".rich_media_meta_nickname", ".profile_nickname"]);
  const publishTime = firstText($, ["#publish_time", ".rich_media_meta_text"]).replace(/\s+/g, " ").trim();

  const root = $("#js_content").first();
  if (!root.length) {
    throw new Error("Unable to locate article content (#js_content). The page might require verification.");
  }

  const fragmentHtml = root.html() || "";
  const $$ = cheerio.load(`<article id=\"article-root\">${fragmentHtml}</article>`, { decodeEntities: true });
  const $root = $$("#article-root");

  // Keep the main content clean and stable for markdown/PDF export.
  $root.find("script, style, iframe, form, button, input, textarea").remove();
  $root.find(".js_uneditable, .js_invalid, .js_minipro_dialog, .js_ad_link").remove();

  const imageUrls = [];
  $root.find("img").each((_, img) => {
    const $img = $$(img);
    const srcCandidate =
      $img.attr("data-src") ||
      $img.attr("data-original") ||
      $img.attr("src") ||
      $img.attr("data-actualsrc");

    const normalized = normalizeAbsoluteUrl(srcCandidate);
    if (normalized) {
      $img.attr("src", normalized);
      imageUrls.push(normalized);
    } else {
      $img.removeAttr("src");
    }

    $img.removeAttr("data-src");
    $img.removeAttr("data-original");
    $img.removeAttr("data-actualsrc");
    $img.removeAttr("srcset");
  });

  $root.find("source").remove();

  const canonicalTitle = title || "wechat-article";

  return {
    title: canonicalTitle,
    author: author || "Unknown",
    publishTime: publishTime || "",
    sourceUrl,
    contentHtml: $root.html() || "",
    imageUrls: Array.from(new Set(imageUrls))
  };
}

async function fetchWechatArticle(inputUrl) {
  const normalizedUrl = normalizeInputUrl(inputUrl);
  assertWechatArticleUrl(normalizedUrl);

  const { text, finalUrl } = await fetchText(normalizedUrl, {
    referer: "https://mp.weixin.qq.com/"
  });

  if (hasCaptchaWall(text, finalUrl)) {
    throw new Error(
      "WeChat returned a verification page for this request. Open the article in a browser first, then try again later or paste the HTML manually."
    );
  }

  return extractArticleFromHtml(text, normalizedUrl);
}

module.exports = {
  fetchWechatArticle,
  extractArticleFromHtml,
  normalizeInputUrl,
  assertWechatArticleUrl
};
