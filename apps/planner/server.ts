import { createRequestListener } from "@react-router/node";
import { createServer } from "node:http";
import { setupYjsWebSocket } from "./app/lib/yjs-server.ts";

const port = Number(process.env.PORT ?? 3001);

const listener = createRequestListener({
  build: () => import("./build/server/index.js") as never,
});

const server = createServer(listener);

setupYjsWebSocket(server);

server.listen(port, () => {
  console.log(`Planner server listening on http://localhost:${port}`);
  console.log(`Yjs WebSocket available at ws://localhost:${port}/sync/:sessionId`);
});
