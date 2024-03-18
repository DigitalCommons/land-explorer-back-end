import { io } from "./server";
let mapUserLocks: { [mapId: number]: number } = {};

/**
 * If there is no lock, lock the map for the given user, and return true.
 * If the map was already locked, return false
 */
export const tryLockMap = (mapId: number, userId: number): boolean => {
  if (mapUserLocks[mapId] !== undefined) {
    return false;
  }

  mapUserLocks[mapId] = userId;

  // send a message to all clients viewing this map
  io.to(`${mapId}`).emit(`mapLock`, { mapId, userId });

  return true;
};

export const unlockMap = (mapId: number, userId: number) => {
  if (mapUserLocks[mapId] === userId) {
    delete mapUserLocks[mapId];
  }

  // send a message to all clients viewing this map
  io.to(`${mapId}`).emit(`mapLock`, { mapId, userId: null });
};

/** Return user ID for user with the map's lock, or null if there is no lock */
export const getUserIdWithLock = (mapId: number) => {
  const userIdWithLock = mapUserLocks[mapId];
  return userIdWithLock !== undefined ? userIdWithLock : null;
};

export const clearAllLocks = () => {
  mapUserLocks = {};
};
