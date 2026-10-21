const path = require("path");
const { createApp } = require("./app");

const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "..", "data", "tasks.json");

const server = createApp({ dataFile: DATA_FILE }).listen(PORT, () =>
  console.log(`Student Task Manager API listening on :${PORT} (data: ${DATA_FILE})`)
);

// Graceful shutdown so containers/pods stop cleanly
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
