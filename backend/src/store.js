const fs = require("fs");
const path = require("path");

// Tiny JSON-file store. Pass no file to keep everything in memory (handy for tests).
function createStore(file) {
  let tasks = [];
  if (file && fs.existsSync(file)) {
    try { tasks = JSON.parse(fs.readFileSync(file, "utf8")); } catch { tasks = []; }
  }
  let nextId = tasks.reduce((m, t) => Math.max(m, t.id), 0) + 1;

  function persist() {
    if (!file) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(tasks, null, 2));
    fs.renameSync(tmp, file); // atomic replace
  }

  return {
    all: () => tasks.slice(),
    get: (id) => tasks.find((t) => t.id === id),
    create(data) {
      const task = {
        id: nextId++,
        title: data.title,
        description: data.description || "",
        deadline: data.deadline || null,
        completed: false,
        createdAt: new Date().toISOString(),
      };
      tasks.push(task);
      persist();
      return task;
    },
    update(id, patch) {
      const task = tasks.find((t) => t.id === id);
      if (!task) return null;
      Object.assign(task, patch);
      persist();
      return task;
    },
    remove(id) {
      const before = tasks.length;
      tasks = tasks.filter((t) => t.id !== id);
      if (tasks.length === before) return false;
      persist();
      return true;
    },
  };
}

module.exports = { createStore };
