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
  // 1. Run DB migrations
  await runMigrations();

  // 2. Initialize SSE Postgres listener
  await initSSEListener();

  // 3. Setup Express
  const app = express();
  app.use(cors());
  app.use(express.json());

  // 4. API routes
  app.use("/api/objectives", objectiveRoutes);
  app.use("/api/memory", memoryRoutes);

  // 5. Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // 6. Serve React frontend in production
  const clientDist = path.resolve("client", "dist");
  app.use(express.static(clientDist));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });

  // 7. Start server
  app.listen(PORT, () => {
    console.log(`[Server] Decision Memory Engine running on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("[Server] Fatal error:", err);
  process.exit(1);
});
