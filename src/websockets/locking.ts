import { getUserInitials } from "../queries/query";
import { io } from "./server";

const mapLockInactivityTimeoutMs: number = Number(
  process.env.MAP_LOCK_INACTIVITY_TIMEOUT_MS || 5 * 60 * 1000 // default 5 mins
);

/**
 * This object keeps track of all maps that are currently locked, and the user that has each lock.
 *
 * Each lock times out if the user doesn't make any edits for a period of time. We store a reference
 * to the timeout that is scheduled to delete each lock, so it can be reset if needed.
 */
let mapUserLocks: {
  [mapId: number]: { userId: number; timeout: NodeJS.Timeout };
} = {};

/**
 * If the map is unlocked, lock the map for the given user, notify all listeners about the new lock,
 * and return true.
 *
 * If the map was already locoked by the same user, reset its timeout and return true.
 *
 * If the map was already locked by a different user, notify all listeners about the existing lock
 * since one of the clients didn't seem to know for some reason, and return false.
 */
export const tryLockMap = async (
  mapId: number,
  userId: number
): Promise<boolean> => {
  console.log(
    `Try locking map ${mapId} to user ${userId}. Current user lock: ${mapUserLocks[mapId]?.userId}`
  );

  if (mapUserLocks[mapId]?.userId === userId) {
    // Map is already locked to this user, reset its timeout
    clearTimeout(mapUserLocks[mapId].timeout);
    mapUserLocks[mapId].timeout = setTimeout(() => {
      maybeUnlock(mapId, userId);
    }, mapLockInactivityTimeoutMs);

    return true;
  }

  if (mapUserLocks[mapId] !== undefined) {
    // Map is already locked to different user
    const userId = mapUserLocks[mapId].userId;
    const userInitials = await getUserInitials(userId);
    io.to(`${mapId}`).emit("mapLock", { mapId, userId, userInitials });
    return false;
  }

  const timeout = setTimeout(() => {
    maybeUnlock(mapId, userId);
  }, mapLockInactivityTimeoutMs);

  mapUserLocks[mapId] = { userId, timeout };

  const userInitials = await getUserInitials(userId);
  io.to(`${mapId}`).emit("mapLock", { mapId, userId, userInitials });
  return true;
};

/**
 * Release this user's lock for the map, notify all listeners that the map is now unlocked, and
 * return true.
 *
 * But if the specified user didn't actually own the lock, return false.
 */
export const maybeUnlock = async (
  mapId: number,
  userId: number
): Promise<boolean> => {
  if (mapUserLocks[mapId]?.userId === userId) {
    clearTimeout(mapUserLocks[mapId].timeout);
    delete mapUserLocks[mapId];

    io.to(`${mapId}`).emit("mapLock", { mapId, userId: null });
    return true;
  }
  return false;
};

/** Return user ID for user with the map's lock, or null if there is no lock */
export const getUserWithLockOrNull = async (
  mapId: number
): Promise<{ id: number; initials: string } | null> => {
  const lock = mapUserLocks[mapId];
  if (lock === undefined) {
    return null;
  }
  const initials = await getUserInitials(lock.userId);
  return { id: lock.userId, initials: initials ?? "??" };
};

export const clearAllLocks = () => {
  Object.values(mapUserLocks).forEach(({ userId, timeout }) =>
    clearTimeout(timeout)
  );
  mapUserLocks = {};
};
