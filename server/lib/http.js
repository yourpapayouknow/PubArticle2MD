const DEFAULT_TEXT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
  Pragma: "no-cache"
};

const DEFAULT_BINARY_HEADERS = {
  "User-Agent": DEFAULT_TEXT_HEADERS["User-Agent"],
  "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
  "Accept-Language": DEFAULT_TEXT_HEADERS["Accept-Language"]
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options = {}, config = {}) {
  const attempts = config.attempts ?? 3;
  const timeoutMs = config.timeoutMs ?? 30000;
  const retryDelayMs = config.retryDelayMs ?? 800;

  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        redirect: "follow",
        ...options,
        signal: controller.signal
      });

      if (response.status === 429 || response.status >= 500) {
        throw new Error(`HTTP ${response.status} from ${url}`);
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(retryDelayMs * attempt);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

function mergeHeaders(defaultHeaders, extraHeaders = {}, referer) {
  const merged = {
    ...defaultHeaders,
    ...extraHeaders
  };

  if (referer) {
    merged.Referer = referer;
  }

  return merged;
}

async function fetchText(url, options = {}) {
  const headers = mergeHeaders(DEFAULT_TEXT_HEADERS, options.headers, options.referer);
  const response = await fetchWithRetry(
    url,
    {
      method: "GET",
      headers
    },
    {
      attempts: options.attempts,
      timeoutMs: options.timeoutMs
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch text: HTTP ${response.status} (${url})`);
  }

  return {
    text: await response.text(),
    finalUrl: response.url,
    status: response.status,
    headers: response.headers
  };
}

async function fetchBuffer(url, options = {}) {
  const headers = mergeHeaders(DEFAULT_BINARY_HEADERS, options.headers, options.referer);
  const response = await fetchWithRetry(
    url,
    {
      method: "GET",
      headers
    },
    {
      attempts: options.attempts,
      timeoutMs: options.timeoutMs
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch binary: HTTP ${response.status} (${url})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") || "application/octet-stream";

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType
  };
}

module.exports = {
  fetchText,
  fetchBuffer
};
