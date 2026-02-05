/**
 * Vercel serverless catch-all: run the Void402 Express backend in this project.
 * All /api/* requests are handled by the same backend (single Vercel project).
 */
import path from "path";
import { pathToFileURL } from "url";

export default async function handler(req: import("http").IncomingMessage, res: import("http").ServerResponse): Promise<void> {
  const backendPath = path.join(process.cwd(), "packages", "backend", "dist", "index.js");
  const app = (await import(pathToFileURL(backendPath).href)).default;
  app(req, res);
}
