const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("../src/app");

let server, base, dataFile;

test.before(
  () =>
    new Promise((resolve) => {
      dataFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "stm-")), "tasks.json");
      server = createApp({ dataFile }).listen(0, () => {
        base = `http://localhost:${server.address().port}`;
        resolve();
      });
    })
);
test.after(() => server.close());

const call = (method, url, body) =>
  fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

test("GET /health returns ok", async () => {
  const res = await call("GET", "/health");
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).status, "ok");
});

test("creates a task with defaults", async () => {
  const res = await call("POST", "/api/tasks", { title: "Math homework", deadline: "2030-01-15" });
  assert.strictEqual(res.status, 201);
  const task = await res.json();
  assert.strictEqual(task.title, "Math homework");
  assert.strictEqual(task.completed, false);
  assert.strictEqual(task.deadline, "2030-01-15");
});

test("rejects missing title, bad deadline, and bad JSON", async () => {
  assert.strictEqual((await call("POST", "/api/tasks", { title: "  " })).status, 400);
  assert.strictEqual((await call("POST", "/api/tasks", { title: "x", deadline: "tomorrow" })).status, 400);
  const bad = await fetch(base + "/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{oops",
  });
  assert.strictEqual(bad.status, 400);
});

test("marks a task completed and filters by status", async () => {
  const { id } = await (await call("POST", "/api/tasks", { title: "Read chapter 4" })).json();
  const patched = await (await call("PATCH", `/api/tasks/${id}`, { completed: true })).json();
  assert.strictEqual(patched.completed, true);

  const done = await (await call("GET", "/api/tasks?status=completed")).json();
  assert.ok(done.some((t) => t.id === id));
  const pending = await (await call("GET", "/api/tasks?status=pending")).json();
  assert.ok(!pending.some((t) => t.id === id));
});

test("deletes a task and returns 404 afterwards", async () => {
  const { id } = await (await call("POST", "/api/tasks", { title: "Temp" })).json();
  assert.strictEqual((await call("DELETE", `/api/tasks/${id}`)).status, 204);
  assert.strictEqual((await call("DELETE", `/api/tasks/${id}`)).status, 404);
  assert.strictEqual((await call("PATCH", `/api/tasks/${id}`, { completed: true })).status, 404);
});

test("persists tasks to disk", async () => {
  await call("POST", "/api/tasks", { title: "Persisted task" });
  const saved = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  assert.ok(saved.some((t) => t.title === "Persisted task"));
});

test("/metrics exposes app and HTTP metrics", async () => {
  const text = await (await call("GET", "/metrics")).text();
  assert.match(text, /student_tasks_total\{status="pending"\}/);
  assert.match(text, /student_tasks_created_total/);
  assert.match(text, /http_request_duration_seconds_bucket/);
});
