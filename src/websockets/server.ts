import { Socket, Server as SocketIOServer } from "socket.io";
import { Server as HapiServer } from "@hapi/hapi";
import { clearAllLocks, maybeUnlock, getUserWithLockOrNull } from "./locking";
import jwt, { JwtPayload } from "jsonwebtoken";

/** The socket.io server object */
export let io: SocketIOServer;

export const setupWebsockets = (server: HapiServer): void => {
  // Reset map locks in the memory and close any existing server before we create a new server
  io?.close();
  clearAllLocks();

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
      // implement authentication, using the same JWT that we use for Hapi API requests
      // see the 'loginUser' function to see token content
      const { token } = socket.handshake.auth;
      const { user_id } = jwt.verify(
        token,
        process.env.TOKEN_KEY ?? ""
      ) as JwtPayload;

      // The client cannot see or edit socket.data so it is safe to just store this on connection
      socket.data.userId = Number(user_id);
    } catch (err) {
      console.log("Failed authentication", err);
      throw err;
    }

    console.log("User websocket connected", socket.data.userId);

    socket.on("disconnecting", () => {
      console.log("User websocket disconnecting", socket.data.userId);
      leaveAllMaps(socket);
    });

    socket.on("currentMap", async (mapId) => {
      if (mapId === null) {
        // null map id means a new untitled map was opened
        console.log(`User ${socket.data.userId} opened a new untitled map`);
        leaveAllMaps(socket);
      } else {
        if (getCurrentMapId(socket) != mapId) {
          console.log(`User ${socket.data.userId} opened map ${mapId}`);
          leaveAllMaps(socket);
          socket.join(`${mapId}`);
        }

        // Tell the user who has the lock (or null if the map is unlocked)
        const user = await getUserWithLockOrNull(mapId);
        socket.emit("mapLock", {
          mapId,
          userId: user?.id ?? null,
          userInitials: user?.initials ?? null,
        });
      }
    });
  });
};

/**
 * For a given socket belonging to a user, return the map ID they are currently viewing or null.
 */
const getCurrentMapId = (userSocket: Socket): number | null => {
  // A user is always in a 'room' with the name of its socket ID, and also may be in a room with the
  // name of the map ID they are currently viewing (if they are viewing a map)
  const currentMaps = [...userSocket.rooms].filter(
    (room) => room !== userSocket.id // ignore socket ID room which a socket is always in
  );

  if (currentMaps.length === 0) {
    return null;
  }

  // a user should only be in one map
  return Number(currentMaps[0]);
};

/**
 * This should only be up to 1 map, but if something went wrong, this should leave all maps anyway.
 */
const leaveAllMaps = (userSocket: Socket) => {
  [...userSocket.rooms]
    .filter((room) => room !== userSocket.id)
    .forEach((mapId) => {
      userSocket.leave(mapId);
      maybeUnlock(Number(mapId), userSocket.data.userId);
    });
};
