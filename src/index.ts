import "dotenv/config";
import { createServer } from "./server.js";

const port = Number(process.env.PORT ?? 3000);
const app = createServer();

const server = app.listen(port, () => {
  console.log(`Shiptec command center listening on http://localhost:${port}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Start Shiptec on another port with:`);
    console.error(`$env:PORT="3001"; npm.cmd run dev`);
    process.exit(1);
  }

  throw error;
});
