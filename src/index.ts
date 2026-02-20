import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";

import { runMigrations } from "./core/db.js";
import { initSSEListener } from "./core/sse.js";
import objectiveRoutes from "./objectives/routes.js";
import memoryRoutes from "./memory/routes.js";

const PORT = parseInt(process.env.PORT || "3001", 10);

async function bootstrap(): Promise<void> {
  await runMigrations();
  await initSSEListener();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/api/objectives", objectiveRoutes);
  app.use("/api/memory", memoryRoutes);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const clientDist = path.resolve("client", "dist");
  app.use(express.static(clientDist));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });

  app.listen(PORT, () => {
    console.log(`[Server] Decision Memory Engine running on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("[Server] Fatal error:", err);
  process.exit(1);
});
