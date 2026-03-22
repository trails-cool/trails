import { createRequestHandler } from "@react-router/node";
import { createServer } from "node:http";
import { setupYjsWebSocket } from "./app/lib/yjs-server";

const port = Number(process.env.PORT ?? 3001);

const handler = createRequestHandler(
  // @ts-expect-error - build output types
  await import("./build/server/index.js"),
);

const server = createServer((req, res) => {
  handler(req, res);
});

setupYjsWebSocket(server);

server.listen(port, () => {
  console.log(`Planner server listening on http://localhost:${port}`);
  console.log(`Yjs WebSocket available at ws://localhost:${port}/sync/:sessionId`);
});
