import { io } from "./server";
let mapUserLocks: { [mapId: number]: number } = {};

export const lockMap = (mapId: number, userId: number) => {
  mapUserLocks[mapId] = userId;

  // send a message to all clients viewing this map
  io.emit(`mapLocked:${mapId}`, { mapId, userId });
};

export const unlockMapIfHasLock = (mapId: number, userId: number) => {
  if (mapUserLocks[mapId] === userId) {
    delete mapUserLocks[mapId];
  }
};

export const clearAllLocks = () => {
  mapUserLocks = {};
};
