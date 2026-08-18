import "./loadEnv.js";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "./db.js";
import authRoutes from "./routes/auth.js";
import classRoutes from "./routes/classes.js";
import studentRoutes from "./routes/students.js";
import gradesRoutes from "./routes/grades.js";
import dashboardRoutes from "./routes/dashboard.js";
import studentDetailRoutes from "./routes/studentDetail.js";
import studentProfileRoutes from "./routes/studentProfile.js";
import materialsRoutes from "./routes/materials.js";
import weeklyPlansRoutes from "./routes/weeklyPlans.js";
import invitationsRoutes from "./routes/invitations.js";
import accountRoutes from "./routes/account.js";
import competenciesRoutes from "./routes/competencies.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "..", "..", "client", "dist");
const serveClient = fs.existsSync(clientDist);

const app = express();
const PORT = Number(process.env.PORT) || 3001;

const corsOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
if (!serveClient) {
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    })
  );
}
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "EduAI API" });
});

app.use("/api/auth", authRoutes);
app.use("/api/invitations", invitationsRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/competencies", competenciesRoutes);
app.use("/api/classes", classRoutes);
app.use("/api", studentRoutes);
app.use("/api", studentDetailRoutes);
app.use("/api", studentProfileRoutes);
app.use("/api", materialsRoutes);
app.use("/api", weeklyPlansRoutes);
app.use("/api", gradesRoutes);
app.use("/api/dashboard", dashboardRoutes);

if (serveClient) {
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Serveri viga." });
});

app.listen(PORT, () => {
  if (serveClient) {
    console.log(`EduAI töötab pordil ${PORT} (frontend + API)`);
  } else {
    console.log(`EduAI API kuulab pordil ${PORT}`);
  }
});
