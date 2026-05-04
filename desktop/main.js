const fs = require("node:fs");
const path = require("node:path");

const { app, BrowserWindow, shell, dialog } = require("electron");
const { startServer } = require("../server");

let mainWindow;
let localApi = null;
let isQuitting = false;

function createWindow(entryUrl) {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    autoHideMenuBar: true,
    title: "PubArticle2MD",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (entryUrl) {
    mainWindow.loadURL(entryUrl);
  } else {
    const entry = path.join(__dirname, "..", "public", "index.html");
    mainWindow.loadFile(entry);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowed = url.startsWith("file:") || url.startsWith("http://localhost:") || url.startsWith("http://127.0.0.1:");
    if (!allowed) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function startLocalApi() {
  try {
    process.env.PUBARTICLE_RUNTIME = app.isPackaged ? "desktop-exe" : "desktop-dev";

    if (app.isPackaged) {
      const bundledBrowsers = path.join(process.resourcesPath, "playwright-browsers");
      if (fs.existsSync(bundledBrowsers)) {
        process.env.PLAYWRIGHT_BROWSERS_PATH = bundledBrowsers;
      }
    }

    localApi = await startServer({
      host: "127.0.0.1",
      port: 0
    });
    return localApi.url;
  } catch (error) {
    const details = error?.message || String(error);
    dialog.showMessageBox({
      type: "warning",
      title: "PubArticle2MD",
      message: "本地 API 启动失败，已自动降级为纯前端模式。",
      detail: details
    });
    return null;
  }
}

async function stopLocalApi() {
  if (!localApi?.server) {
    return;
  }

  await new Promise((resolve) => {
    localApi.server.close(() => resolve());
  });

  localApi = null;
}

app.whenReady().then(async () => {
  const localApiUrl = await startLocalApi();
  createWindow(localApiUrl);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(localApi?.url || null);
    }
  });
});

app.on("render-process-gone", (_event, webContents, details) => {
  const reason = details?.reason || "unknown";
  dialog.showErrorBox("PubArticle2MD", `Renderer process exited: ${reason}`);
  if (!webContents.isDestroyed()) {
    webContents.reload();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", (event) => {
  if (isQuitting) {
    return;
  }

  if (!localApi?.server) {
    return;
  }

  event.preventDefault();
  isQuitting = true;
  stopLocalApi()
    .catch(() => {
      // Ignore close errors during shutdown.
    })
    .finally(() => {
      app.quit();
    });
});
