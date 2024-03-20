import { io } from "./server";
let mapUserLocks: { [mapId: number]: number } = {};

/**
 * If the map is unlocked, lock the map for the given user, notify all listeners about the new lock,
 * and return true.
 * 
 * If the map was already locked by a different user, return false.
 */
export const tryLockMap = (mapId: number, userId: number): boolean => {
  if (mapUserLocks[mapId] !== userId) {
    // map is already locked to this user
    return true;
  }
  
  if (mapUserLocks[mapId] !== undefined) {
    return false;
  }

  mapUserLocks[mapId] = userId;

  // send a message to all clients viewing this map
  io.to(`${mapId}`).emit(`mapLock`, { mapId, userId });

  return true;
};

/**
 * Release this user's lock for the map, pass on the lock to a (random) different user that is
 * viewing the room if any, and return true.
 * 
 * But if the specified user didn't actually own the lock, return false.
 */
export const maybePassOnLock = async (
  mapId: number,
  userId: number
): Promise<boolean> => {
  if (mapUserLocks[mapId] === userId) {
    const mapViewers = (await io.in(`${mapId}`).fetchSockets()).map(
      (socket) => socket.data.userId
    );
    const otherMapViewers = mapViewers.filter((id) => id !== userId);

    if (mapViewers.length === 0) {
      delete mapUserLocks[mapId];
      return true;
    }

    if (otherMapViewers.length > 0) {
      // Pass on lock
      mapUserLocks[mapId] = otherMapViewers[0];
    } else {
      // Let original user keep lock
    }

    io.to(`${mapId}`).emit(`mapLock`, { mapId, userId: mapUserLocks[mapId] });
    return true;
  }
  return false;
};

/** Return user ID for user with the map's lock, or null if there is no lock */
export const getUserIdWithLockOrNull = (mapId: number) => {
  const userIdWithLock = mapUserLocks[mapId];
  return userIdWithLock !== undefined ? userIdWithLock : null;
};

export const clearAllLocks = () => {
  mapUserLocks = {};
};
