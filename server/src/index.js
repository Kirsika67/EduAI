import "./loadEnv.js";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "./db.js";
import { securityHeaders, forceHttps, authLimiter, apiLimiter } from "./middleware/security.js";
import { startBackupSchedule } from "./services/backup.js";
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
import timetableRoutes from "./routes/timetable.js";
import parentMeetingsRoutes from "./routes/parentMeetings.js";
import attendanceBoardRoutes from "./routes/attendanceBoard.js";
import messagesRoutes from "./routes/messages.js";
import mentoringRoutes from "./routes/mentoring.js";
import schoolRoutes from "./routes/school.js";
import activitiesRoutes from "./routes/activities.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "..", "..", "client", "dist");
const serveClient = fs.existsSync(clientDist);
const isProduction = process.env.NODE_ENV === "production";

/**
 * Saladused peavad olema olemas ENNE kui server üldse käivitub.
 *
 * Varem oli koodis vaikeväärtus "arendus-vale-võti": kui JWT_SECRET puudus,
 * käivitus rakendus vaikselt edasi ja kõik seansitokenid olid allkirjastatud
 * avalikult teadaoleva stringiga. Pilves on see täielik autentimise
 * möödaminek. Seepärast: tootmises katkeb käivitus kohe ja valjult.
 */
if (isProduction) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    console.error(
      "[EduAI] Käivitus katkestatud: JWT_SECRET puudub või on alla 32 tähemärgi."
    );
    process.exit(1);
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 3001;

/** Renderi ees on proxy: ilma selleta on req.ip proxy oma ja req.secure alati false. */
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(forceHttps);
app.use(securityHeaders);

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

/** Terviseotspunkt jääb limiitidest välja — Render pingib seda pidevalt. */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "EduAI API" });
});

app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/invitations", invitationsRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/competencies", competenciesRoutes);
app.use("/api/timetable", timetableRoutes);
app.use("/api/parent-meetings", parentMeetingsRoutes);
app.use("/api/attendance", attendanceBoardRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/mentoring", mentoringRoutes);
app.use("/api/school", schoolRoutes);
app.use("/api/activities", activitiesRoutes);
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
  const mode = isProduction ? "tootmine" : "arendus";
  if (serveClient) {
    console.log(`EduAI töötab pordil ${PORT} (frontend + API, ${mode})`);
  } else {
    console.log(`EduAI API kuulab pordil ${PORT} (${mode})`);
  }

  /**
   * Varundus käib ainult pilves. Kohalikult ei ole mõtet iga käivitusega
   * koopiaid tekitada — `BACKUPS=on` lülitab selle vajadusel ka siin sisse.
   */
  if (isProduction || String(process.env.BACKUPS).toLowerCase() === "on") {
    startBackupSchedule();
  }
});
