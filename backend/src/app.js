const express = require("express");
const cors = require("cors");
const client = require("prom-client");
const { createStore } = require("./store");

function validate(body, { partial }) {
  const out = {};
  const errors = [];

  if (!partial || body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) errors.push("title is required");
    else if (title.length > 120) errors.push("title must be 120 characters or fewer");
    else out.title = title;
  }
  if (body.description !== undefined) {
    if (typeof body.description !== "string" || body.description.length > 500)
      errors.push("description must be a string up to 500 characters");
    else out.description = body.description.trim();
  }
  if (body.deadline !== undefined && body.deadline !== null && body.deadline !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.deadline) || Number.isNaN(Date.parse(body.deadline)))
      errors.push("deadline must be a valid date in YYYY-MM-DD format");
    else out.deadline = body.deadline;
  } else if (body.deadline === null || body.deadline === "") {
    out.deadline = null;
  }
  if (body.completed !== undefined) {
    if (typeof body.completed !== "boolean") errors.push("completed must be true or false");
    else out.completed = body.completed;
  }
  return { out, errors };
}

function createApp({ dataFile } = {}) {
  const app = express();
  const store = createStore(dataFile);

  // ---------- Prometheus metrics ----------
  const register = new client.Registry();
  client.collectDefaultMetrics({ register });

  const httpDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [register],
  });
  const tasksCreated = new client.Counter({
    name: "student_tasks_created_total",
    help: "Total tasks created since start",
    registers: [register],
  });
  new client.Gauge({
    name: "student_tasks_total",
    help: "Current number of tasks by status",
    labelNames: ["status"],
    registers: [register],
    collect() {
      const all = store.all();
      const done = all.filter((t) => t.completed).length;
      this.set({ status: "completed" }, done);
      this.set({ status: "pending" }, all.length - done);
    },
  });

  app.use(cors());
  app.use(express.json());

  app.use((req, res, next) => {
    const end = httpDuration.startTimer();
    res.on("finish", () => {
      const route = req.route ? req.baseUrl + req.route.path : "unmatched";
      end({ method: req.method, route, status: res.statusCode });
    });
    next();
  });

  // ---------- Ops endpoints ----------
  app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));
  app.get("/metrics", async (req, res) => {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  });

  // ---------- Task API ----------
  app.get("/api/tasks", (req, res) => {
    let tasks = store.all();
    if (req.query.status === "completed") tasks = tasks.filter((t) => t.completed);
    else if (req.query.status === "pending") tasks = tasks.filter((t) => !t.completed);
    res.json(tasks);
  });

  app.post("/api/tasks", (req, res) => {
    const { out, errors } = validate(req.body || {}, { partial: false });
    if (errors.length) return res.status(400).json({ errors });
    tasksCreated.inc();
    res.status(201).json(store.create(out));
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!store.get(id)) return res.status(404).json({ error: "task not found" });
    const { out, errors } = validate(req.body || {}, { partial: true });
    if (errors.length) return res.status(400).json({ errors });
    res.json(store.update(id, out));
  });

  app.delete("/api/tasks/:id", (req, res) => {
    if (!store.remove(Number(req.params.id))) return res.status(404).json({ error: "task not found" });
    res.status(204).end();
  });

  // ---------- Errors ----------
  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "invalid JSON" });
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  });

  return app;
}

module.exports = { createApp };
