import type { Express } from "express";
import express from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function registerVite(app: Express) {
  if (process.env.NODE_ENV === "production") {
    const distPath = path.resolve(__dirname, "../dist/client");
    if (!fs.existsSync(distPath)) {
      throw new Error(
        `Could not find the build directory: ${distPath}, make sure to build the client first`
      );
    }
    app.use(express.static(distPath));
    app.use("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });

    return createServer(app);
  } else {
    return await setupDevelopmentServer(app);
  }
}

async function setupDevelopmentServer(app: Express) {
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: true },
    appType: "custom",
    configFile: path.resolve(__dirname, "../vite.config.ts"),
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientPath = path.resolve(__dirname, "../client");
      const template = fs.readFileSync(
        path.resolve(clientPath, "index.html"),
        "utf-8"
      );
      const page = await vite.transformIndexHtml(url, template);

      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });

  return createServer(app);
}

