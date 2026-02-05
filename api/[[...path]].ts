/**
 * Vercel serverless catch-all: run the Void402 Express backend in this project.
 * All /api/* requests (GET, POST, etc.) are handled by the same backend.
 */
import path from "path";
import { pathToFileURL } from "url";

type Req = import("http").IncomingMessage;
type Res = import("http").ServerResponse;

export default async function handler(req: Req, res: Res): Promise<void> {
  const backendPath = path.join(process.cwd(), "packages", "backend", "dist", "index.js");
  const { default: app } = await import(pathToFileURL(backendPath).href);
  await new Promise<void>((resolve, reject) => {
    res.once("finish", () => resolve());
    res.once("error", reject);
    app(req, res);
  });
}
