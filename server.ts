import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const db = new Database("patient_data.db");

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    is_master INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS medical_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER,
    date TEXT,
    summary TEXT,
    full_text TEXT,
    type TEXT,
    follow_ups TEXT,
    details TEXT,
    FOREIGN KEY(profile_id) REFERENCES profiles(id)
  );

  CREATE TABLE IF NOT EXISTS daily_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER,
    date TEXT,
    symptom_description TEXT,
    FOREIGN KEY(profile_id) REFERENCES profiles(id)
  );

  CREATE TABLE IF NOT EXISTS insurance_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER,
    type TEXT,
    provider TEXT,
    benefits_summary TEXT,
    usage_data TEXT,
    FOREIGN KEY(profile_id) REFERENCES profiles(id)
  );
`);

// Seed initial profile if empty
const profileCount = db.prepare("SELECT count(*) as count FROM profiles").get() as { count: number };
if (profileCount.count === 0) {
  db.prepare("INSERT INTO profiles (name, relationship, is_master) VALUES (?, ?, ?)").run("Me", "Self", 1);
}

// One-time cleanup: Delete specific card and ensure no "prestored" info if requested
// (In a real app, this would be a migration, but here we act on the user's specific request)
db.prepare("DELETE FROM insurance_policies WHERE provider LIKE '%Wellfleet Student%' OR provider LIKE '%Wellfleet student%'").run();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/profiles", (req, res) => {
    const profiles = db.prepare("SELECT * FROM profiles").all();
    res.json(profiles);
  });

  app.post("/api/profiles", (req, res) => {
    const { name, relationship } = req.body;
    const result = db.prepare("INSERT INTO profiles (name, relationship) VALUES (?, ?)").run(name, relationship);
    res.json({ id: result.lastInsertRowid });
  });

  app.get("/api/records/:profileId", (req, res) => {
    const records = db.prepare("SELECT * FROM medical_records WHERE profile_id = ? ORDER BY date DESC").all(req.params.profileId);
    res.json(records);
  });

  app.post("/api/records", (req, res) => {
    const { profile_id, date, summary, full_text, type, follow_ups, details } = req.body;
    const result = db.prepare("INSERT INTO medical_records (profile_id, date, summary, full_text, type, follow_ups, details) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(profile_id, date, summary, full_text, type, JSON.stringify(follow_ups), JSON.stringify(details));
    res.json({ id: result.lastInsertRowid });
  });

  app.get("/api/insurance/:profileId", (req, res) => {
    const policies = db.prepare("SELECT * FROM insurance_policies WHERE profile_id = ?").all(req.params.profileId);
    res.json(policies);
  });

  app.post("/api/insurance", (req, res) => {
    const { profile_id, type, provider, benefits_summary } = req.body;
    const result = db.prepare("INSERT INTO insurance_policies (profile_id, type, provider, benefits_summary) VALUES (?, ?, ?, ?)")
      .run(profile_id, type, provider, JSON.stringify(benefits_summary));
    res.json({ id: result.lastInsertRowid });
  });

  app.get("/api/logs/:profileId", (req, res) => {
    const logs = db.prepare("SELECT * FROM daily_logs WHERE profile_id = ? ORDER BY date DESC").all(req.params.profileId);
    res.json(logs);
  });

  app.post("/api/logs", (req, res) => {
    const { profile_id, date, symptom_description } = req.body;
    const result = db.prepare("INSERT INTO daily_logs (profile_id, date, symptom_description) VALUES (?, ?, ?)")
      .run(profile_id, date, symptom_description);
    res.json({ id: result.lastInsertRowid });
  });

  app.post("/api/insurance/:id/update", (req, res) => {
    const { benefits_summary } = req.body;
    db.prepare("UPDATE insurance_policies SET benefits_summary = ? WHERE id = ?")
      .run(JSON.stringify(benefits_summary), req.params.id);
    res.json({ status: "ok" });
  });

  app.delete("/api/insurance/:id", (req, res) => {
    db.prepare("DELETE FROM insurance_policies WHERE id = ?").run(req.params.id);
    res.json({ status: "ok" });
  });

  app.delete("/api/records/:id", (req, res) => {
    db.prepare("DELETE FROM medical_records WHERE id = ?").run(req.params.id);
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
