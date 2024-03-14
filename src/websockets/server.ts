import { Server as SocketIOServer } from "socket.io";
import { Server as HapiServer } from "@hapi/hapi";
import { clearAllLocks, unlockMapIfHasLock } from "./locking";
const jwt = require("jsonwebtoken");

// #306 Enable multiple users to write to a map

export const setupWebsockets = (server: HapiServer): void => {
  const io: SocketIOServer = new SocketIOServer(
    server.listener,
    process.env.NODE_ENV === "development"
      ? {
          cors: {
            origin: "http://localhost:8080",
          },
        }
      : {}
  );

  io.on("connection", (socket) => {
    try {
      // see the loginUser function to see token content
      const { token } = socket.handshake.auth;
      const { user_id } = jwt.verify(token, process.env.TOKEN_KEY);
      socket.data.userId = user_id;
    } catch (err) {
      console.log("Failed authentication", err);
      throw err;
    }

    console.log("User websocket connected", socket.data.userId);

    socket.on("disconnect", () => {
      console.log("User websocket disconnected", socket.data.userId);
    });

    socket.emit("update", { message: "Welcome to the server" });

    socket.on("currentMap", (mapId) => {
      console.log(`User ${socket.data.userId} opened map ${mapId}`);
    });

    socket.on("closeMap", (mapId) => {
      const userId = socket.data.userId;
      console.log(`User ${userId} closed map ${mapId}`);
      unlockMapIfHasLock(mapId, userId);
    });

    socket.on("update", (data) => {
      console.log("Received update", data);
      io.emit("update", data);
    });
  });

  clearAllLocks();
};
