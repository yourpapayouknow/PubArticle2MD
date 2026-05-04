const path = require("node:path");

const { app, BrowserWindow, shell, dialog } = require("electron");

let mainWindow;

function createWindow() {
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

  const entry = path.join(__dirname, "..", "public", "index.html");
  mainWindow.loadFile(entry);

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

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
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
