

let mapUserLocks: {[mapId: number]: number} = {}

export const lockMap = (mapId: number, userId: number) => {
    mapUserLocks[mapId] = userId;

    // send a message to all clients viewing this map
}

export const unlockMapIfHasLock = (mapId: number, userId: number) => {
    if (mapUserLocks[mapId] === userId) {
        delete mapUserLocks[mapId];
    }
}

export const clearAllLocks = () => {
    mapUserLocks = {};
}
