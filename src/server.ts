"use strict";

import Hapi from "@hapi/hapi";
import { Request, Server } from "@hapi/hapi";
import { databaseRoutes } from "./routes/database";
import { emailRoutes } from "./routes/emails";
import { mapRoutes } from "./routes/maps";
import { dataGroupRoutes } from "./routes/datagroups";
import { setupWebsockets } from "./websockets/server";
import { EventEmitter } from "events";

const AuthBearer = require("hapi-auth-bearer-token");
const Inert = require("@hapi/inert");
const jwt = require("jsonwebtoken");

export let server: Server;

function index(request: Request): string {
  console.log("Processing request", request.info.id);
  return "Hello! Nice to have met you...";
}

// #306 Enable multiple users to write to a map
// M.S. Server-Sent Events (SSE) for real-time updates
// https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events

// function sse(request: Request, h: any): any {
//   const eventEmitter = new EventEmitter();

//   // Set up CORS headers conditionally
//   const response = h
//     .response()
//     .header("Content-Type", "text/event-stream")
//     .header("Cache-Control", "no-cache")
//     .header("Connection", "keep-alive");

//   if (process.env.NODE_ENV === "development") {
//     response.header("Access-Control-Allow-Origin", "http://localhost:8080"); // Adjust origin as needed
//   }

//   response.code(200);

//   // Notify that a new client has connected
//   eventEmitter.emit("newConnection", response);

//   // Send SSE events to clients
//   eventEmitter.on("event", (data) => {
//     response.write("data: " + JSON.stringify(data) + "\n\n");
//   });

//   // Clear the interval when the client disconnects
//   eventEmitter.on("disconnect", () => {
//     eventEmitter.removeAllListeners();
//   });

//   return response;
// }

export const init = async function (): Promise<Server> {
  server = Hapi.server({
    port: process.env.PORT || 4000,
    host: "0.0.0.0",
    debug: { log: ["error"], request: ["error"] },
    // if we are running in development, allow requests from the expected localhost:8080 origin
    routes: {
      cors: process.env.NODE_ENV === "development" && {
        origin: ["http://localhost:8080"],
        // Allow WebSocket connections
        additionalHeaders: ["authorization", "content-type"],
      },
    },
  });

  await server.register(AuthBearer);
  await server.register(Inert);

  server.auth.strategy("simple", "bearer-access-token", {
    allowQueryToken: true, // optional, false by default
    validate: async (request: any, token: string, h: any) => {
      let isValid = false;
      let credentials = {};

      try {
        // see the loginUser function to see token content
        const decodedToken = jwt.verify(token, process.env.TOKEN_KEY);

        isValid = true;
        credentials = { user_id: decodedToken.user_id };
      } catch (err) {
        console.log("Failed authentication", err);
      }

      return { isValid, credentials };
    },
  });

  server.auth.default("simple");

  server.route({
    method: "GET",
    path: "/",
    handler: index,
    options: {
      auth: false,
    },
  });

  // #306 Enable multiple users to write to a map
  // M.S. SSE route

  // server.route({
  //   method: "GET",
  //   path: "/api/sse",
  //   handler: sse,
  //   options: {
  //     auth: false,
  //   },
  // });

  server.route(databaseRoutes);
  server.route(mapRoutes);
  server.route(dataGroupRoutes);
  server.route(emailRoutes);

  // Log requests and response codes
  server.events.on("response", (request: any) => {
    console.log(
      request.info.remoteAddress +
        ": " +
        request.method.toUpperCase() +
        " " +
        request.path +
        " --> " +
        request.response.statusCode
    );
  });

  setupWebsockets(server);

  return server;
};

export const start = async function (): Promise<void> {
  console.log(`Listening on ${server.settings.host}:${server.settings.port}`);
  return server.start();
};

process.on("unhandledRejection", (err) => {
  console.error("unhandledRejection");
  console.error(err);
  process.exit(1);
});
