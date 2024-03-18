import { Socket, Server as SocketIOServer } from "socket.io";
import { Server as HapiServer } from "@hapi/hapi";
import { clearAllLocks, unlockMap, getUserIdWithLock, tryLockMap } from "./locking";
const jwt = require("jsonwebtoken");

// #306 Enable multiple users to write to a map

export let io: SocketIOServer;

export const setupWebsockets = (server: HapiServer): void => {
  io = new SocketIOServer(
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

    socket.on("disconnecting", () => {
      console.log("User websocket disconnecting", socket.data.userId);
      leaveAllMaps(socket);
    });

    socket.on("currentMap", (mapId) => {
      if (mapId !== null) {
        if (getCurrentMapId(socket) != mapId) {
          console.log(`User ${socket.data.userId} opened map ${mapId}`);
          leaveAllMaps(socket);
          socket.join(`${mapId}`);
        }

        // Try locking the map (or send info about who has the lock)
        const success = tryLockMap(mapId, socket.data.userId);
        const userId = success ? socket.data.userId : getUserIdWithLock(mapId);
        socket.emit(`mapLock`, { mapId, userId });
      } else {
        // null map id means a new map was opened
        leaveAllMaps(socket);
      }
    });

    // socket.on("closeMap", (mapId) => {
    //   const userId = socket.data.userId;
    //   console.log(`User ${userId} closed map ${mapId}`);
    //   unlockMap(mapId, userId);
    //   socket.leave(`${mapId}`);
    // });
  });

  clearAllLocks();
};

const getCurrentMapId = (userSocket: Socket): number | null => {
  const currentMaps = [...userSocket.rooms].filter((room) => room !== userSocket.id);

  if (currentMaps.length === 0) {
    return null;
  }

  // a user should only be in one map
  return Number(currentMaps[0]);
};

const leaveAllMaps = (userSocket: Socket) => {
  [...userSocket.rooms]
    .filter((room) => room !== userSocket.id)
    .forEach((mapId) => {
      userSocket.leave(mapId);
      unlockMap(Number(mapId), userSocket.data.userId);
    });
};
