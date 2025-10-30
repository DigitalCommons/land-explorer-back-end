import {
  Map,
  User,
  UserMap,
  PendingUserMap,
  UserMapAccess,
  Marker,
  Polygon,
  Line,
  MapMembership,
  ItemTypeId,
  DataGroup,
  DataGroupId,
} from "./database";
import { Op } from "sequelize";
import { createHash } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { getUserByEmail, hashUserId, trackUserEvent } from "./query";
import * as mailer from "./mails";
import { Event, EventName } from "../instrument";
import * as Sentry from "@sentry/node";
import { atomizeChangeset, diff } from "json-diff-ts";

const getMap = async (mapId: number) =>
  await Map.findOne({
    where: {
      id: mapId,
    },
  });

/**
 * Convert a mapId to a hashed value, using the map creation date as a salt and then adding the
 * secret pepper, to anonymize it for analytics.
 */
const hashMapId = async (mapId: number) => {
  const map = await getMap(mapId);
  if (!map) {
    console.error(`Map with ID ${mapId} not found for hashing`);
    return "MAP_NOT_FOUND";
  }

  const saltAndPepperedInput = `${mapId}${map.created_date}${process.env.ANALYTICS_PEPPER}`;

  return createHash("sha256")
    .update(saltAndPepperedInput)
    .digest("hex")
    .substring(0, 16); // truncate to length of 16 chars
};

/**
 * A wrapper function that should be called for analytic events in the app, that are associated with
 * a user's saved map.
 */
export const trackUserMapEvent = async (
  userId: number,
  mapId: number,
  event: EventName,
  data?: any
) => {
  const mapIdHash = await hashMapId(mapId);
  trackUserEvent(userId, event, {
    ...data,
    map_id: mapIdHash,
  });
};

export const getMapMarkers = async (mapId: number) => {
  const mapMemberships = await MapMembership.findAll({
    where: {
      map_id: mapId,
      item_type_id: ItemTypeId.Marker,
    },
  });

  const markers = [];

  for (const mapMembership of mapMemberships) {
    const marker = await Marker.findOne({
      where: {
        idmarkers: mapMembership.item_id,
      },
    });

    if (!marker) {
      console.error(
        `Marker with ID ${mapMembership.item_id} not found for map ${mapId} despite membership`
      );
      // something has gone wrong, so delete the redundant map membership and log to Glitchtip so we
      // can track instances of this
      await MapMembership.destroy({
        where: {
          map_id: mapId,
          item_type_id: ItemTypeId.Marker,
          item_id: mapMembership.item_id,
        },
      });
      Sentry.captureMessage(
        `Marker with ID ${mapMembership.item_id} not found for map ${mapId} despite membership`,
        "error"
      );
      continue;
    }

    // Form JSON that is used by front end
    markers.push({
      uuid: marker.uuid,
      coordinates: marker.location.coordinates,
      name: marker.name,
      description: marker.description,
    });
  }

  // Add markers that are still stored in data JSON (if any)
  const map = await getMap(mapId);
  const mapData = JSON.parse(map.data);
  markers.push(...(mapData.markers.markers ?? []));

  return markers;
};

export const getMapPolygonsAndLines = async (mapId: number) => {
  const mapPolygonMemberships = await MapMembership.findAll({
    where: {
      map_id: mapId,
      item_type_id: ItemTypeId.Polygon,
    },
  });
  const mapLineMemberships = await MapMembership.findAll({
    where: {
      map_id: mapId,
      item_type_id: ItemTypeId.Line,
    },
  });

  const polygonsAndLines = [];

  // Add polygons
  for (const mapMembership of mapPolygonMemberships) {
    const polygon = await Polygon.findOne({
      where: {
        idpolygons: mapMembership.item_id,
      },
    });

    if (!polygon) {
      console.error(
        `Polygon with ID ${mapMembership.item_id} not found for map ${mapId} despite membership`
      );
      // something has gone wrong, so delete the redundant map membership and log to Glitchtip so we
      // can track instances of this
      await MapMembership.destroy({
        where: {
          map_id: mapId,
          item_type_id: ItemTypeId.Polygon,
          item_id: mapMembership.item_id,
        },
      });
      Sentry.captureMessage(
        `Polygon with ID ${mapMembership.item_id} not found for map ${mapId} despite membership`,
        "error"
      );
      continue;
    }

    polygonsAndLines.push({
      name: polygon.name,
      description: polygon.description,
      type: "Polygon",
      // Form GeoJSON that is used by front end
      data: {
        id: polygon.uuid,
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: polygon.vertices.coordinates,
        },
      },
      center: polygon.center.coordinates,
      length: polygon.length,
      area: polygon.area,
      uuid: polygon.uuid,
    });
  }

  // Add lines
  for (const mapMembership of mapLineMemberships) {
    const line = await Line.findOne({
      where: {
        idlinestrings: mapMembership.item_id,
      },
    });

    if (!line) {
      console.error(
        `Line with ID ${mapMembership.item_id} not found for map ${mapId} despite membership`
      );
      // something has gone wrong, so delete the redundant map membership and log to Glitchtip so we
      // can track instances of this
      await MapMembership.destroy({
        where: {
          map_id: mapId,
          item_type_id: ItemTypeId.Line,
          item_id: mapMembership.item_id,
        },
      });
      Sentry.captureMessage(
        `Line with ID ${mapMembership.item_id} not found for map ${mapId} despite membership`,
        "error"
      );
      continue;
    }

    polygonsAndLines.push({
      name: line.name,
      description: line.description,
      type: "LineString",
      // Form GeoJSON that is used by front end
      data: {
        id: line.uuid,
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: line.vertices.coordinates,
        },
      },
      length: line.length,
      uuid: line.uuid,
    });
  }

  // Add drawings that are still stored in data JSON (if any)
  const map = await getMap(mapId);
  const mapData = JSON.parse(map.data);
  polygonsAndLines.push(...(mapData.drawings.polygons ?? [])); // drawings.polygons is the old field name

  const numPolygons = polygonsAndLines.filter(
    (p) => p.type === "Polygon"
  ).length;

  return polygonsAndLines;
};

/**
 * Create a single or multiple map memberships for a particular map and item type. Don't create
 * duplicates if the membership already exists.
 */
export const bulkCreateMapMemberships = async (
  mapId: number,
  itemTypeId: number,
  itemId: number | number[]
) => {
  const itemIds = Array.isArray(itemId) ? itemId : [itemId];
  if (itemIds.length > 0) {
    await MapMembership.bulkCreate(
      itemIds.map((item_id) => ({
        map_id: mapId,
        item_type_id: itemTypeId,
        item_id,
      })),
      {
        fields: ["map_id", "item_type_id", "item_id"],
        ignoreDuplicates: true,
      }
    );
  }
};

/**
 * Create each marker where a UUID doesn't already exist. If the UUID already exists, update the
 * existing record with the new values. Also, if deleteMissing is true, delete any existing markers
 * that are not in the new data.
 */
export const bulkCreateUpdateAndDeleteMarkers = async (
  mapId: number,
  markers: any[],
  deleteMissing: boolean
) => {
  const parsedMarkers = markers.map((marker) => ({
    name: marker.name,
    description: marker.description,
    location: {
      type: "Point",
      coordinates: marker.coordinates,
    },
    uuid: marker.uuid,
    data_group_id: DataGroupId.None,
  }));
  const markerUuids = parsedMarkers.map((marker) => marker.uuid);

  // First check which markers need to be deleted from the DB
  let markerUuidsToRemove = [];

  if (deleteMissing) {
    const mapMemberships = await MapMembership.findAll({
      where: { map_id: mapId, item_type_id: ItemTypeId.Marker },
    });
    const existingMarkerUuids: string[] = await Marker.findAll({
      where: {
        idmarkers: mapMemberships.map((item: any) => item.item_id),
      },
    }).then((markers: any[]) => markers.map((marker) => marker.uuid));
    markerUuidsToRemove = existingMarkerUuids.filter(
      (uuid) => !markerUuids.includes(uuid)
    );
    await Marker.destroy({
      where: {
        uuid: markerUuidsToRemove,
      },
    });
  }

  // Now create/update markers
  await Marker.bulkCreate(parsedMarkers, {
    fields: ["name", "description", "location", "uuid", "data_group_id"],
    updateOnDuplicate: ["name", "description", "location", "data_group_id"],
  });
  const updatedMarkerIds = (
    await Marker.findAll({
      where: { uuid: markerUuids },
    })
  ).map((marker: any) => marker.idmarkers);

  await bulkCreateMapMemberships(mapId, ItemTypeId.Marker, updatedMarkerIds);

  console.log(
    `Created/updated ${updatedMarkerIds.length} and removed ${markerUuidsToRemove.length} markers`
  );
};

/**
 * Create each polygon/line where a UUID doesn't already exist. If the UUID already exists, update
 * the existing record with the new values. And, if deleteMissing is true, delete any existing
 * polygons/lines that are not in the new data.
 *
 * TODO: we could maybe neaten this function up and commonalise repetition of code which is similar
 * for markers, polygons and lines
 */
const bulkCreateUpdateAndDeletePolygonsAndLines = async (
  mapId: number,
  polygonsAndLines: any[],
  deleteMissing: boolean
) => {
  const parsedPolygons = polygonsAndLines
    .filter((item) => item.data.geometry.type === "Polygon")
    .map((item) => ({
      name: item.name,
      description: item.description,
      vertices: item.data.geometry,
      center: {
        type: "Point",
        coordinates: item.center,
      },
      length: item.length,
      area: item.area,
      uuid: item.uuid,
      data_group_id: DataGroupId.None,
    }));
  const polygonUuids = parsedPolygons.map((polygon) => polygon.uuid);

  const parsedLines = polygonsAndLines
    .filter((item) => item.data.geometry.type === "LineString")
    .map((item) => ({
      name: item.name,
      description: item.description,
      vertices: item.data.geometry,
      length: item.length,
      uuid: item.uuid,
      data_group_id: DataGroupId.None,
    }));
  const lineUuids = parsedLines.map((line) => line.uuid);

  // First check which polygons and lines need to be deleted from the DB
  let polygonUuidsToRemove = [];
  let lineUuidsToRemove = [];

  if (deleteMissing) {
    const polygonMapMemberships = await MapMembership.findAll({
      where: { map_id: mapId, item_type_id: ItemTypeId.Polygon },
    });
    const existingPolygonUuids: string[] = await Polygon.findAll({
      where: {
        idpolygons: polygonMapMemberships.map((item: any) => item.item_id),
      },
    }).then((polygons: any[]) => polygons.map((polygon) => polygon.uuid));
    polygonUuidsToRemove = existingPolygonUuids.filter(
      (uuid) => !polygonUuids.includes(uuid)
    );
    await Polygon.destroy({
      where: {
        uuid: polygonUuidsToRemove,
      },
    });

    const lineMapMemberships = await MapMembership.findAll({
      where: { map_id: mapId, item_type_id: ItemTypeId.Line },
    });
    const existingLineUuids: string[] = await Line.findAll({
      where: {
        idlinestrings: lineMapMemberships.map((item: any) => item.item_id),
      },
    }).then((lines: any[]) => lines.map((line) => line.uuid));
    lineUuidsToRemove = existingLineUuids.filter(
      (uuid) => !lineUuids.includes(uuid)
    );
    await Line.destroy({
      where: {
        uuid: lineUuidsToRemove,
      },
    });
  }

  // Now create or update polygons and lines
  await Polygon.bulkCreate(parsedPolygons, {
    fields: [
      "name",
      "description",
      "vertices",
      "center",
      "length",
      "area",
      "uuid",
      "data_group_id",
    ],
    updateOnDuplicate: [
      "name",
      "description",
      "vertices",
      "center",
      "length",
      "area",
      "data_group_id",
    ],
  });
  const updatedPolygonIds = (
    await Polygon.findAll({
      where: { uuid: polygonUuids },
    })
  ).map((polygon: any) => polygon.idpolygons);

  await bulkCreateMapMemberships(mapId, ItemTypeId.Polygon, updatedPolygonIds);

  await Line.bulkCreate(parsedLines, {
    fields: [
      "name",
      "description",
      "vertices",
      "length",
      "uuid",
      "data_group_id",
    ],
    updateOnDuplicate: [
      "name",
      "description",
      "vertices",
      "length",
      "data_group_id",
    ],
  });
  const updatedLineIds = (
    await Line.findAll({
      where: { uuid: lineUuids },
    })
  ).map((line: any) => line.idlinestrings);

  await bulkCreateMapMemberships(mapId, ItemTypeId.Line, updatedLineIds);

  console.log(
    `Created/updated ${updatedPolygonIds.length} polygons ${updatedLineIds.length} lines and removed ${polygonUuidsToRemove.length} polygons ${lineUuidsToRemove.length} lines`
  );
};

/* Copy all data group objects to a specified new map. */
const copyDataGroupObjectsToNewMap = async (
  mapId: number,
  dataGroupIds: any
) => {
  console.log(
    `Copying data group objects from ${dataGroupIds} to new map`,
    mapId
  );

  const markers: any[] = [];
  const polygonsAndLines: any[] = [];

  for (const id of dataGroupIds) {
    markers.push(
      ...(
        await Marker.findAll({
          where: {
            data_group_id: id,
          },
        })
      ).map((marker: any) => ({
        name: marker.name,
        description: marker.description,
        coordinates: marker.location.coordinates,
        uuid: uuidv4(),
      }))
    );

    polygonsAndLines.push(
      ...(
        await Polygon.findAll({
          where: {
            data_group_id: id,
          },
        })
      ).map((polygon: any) => ({
        name: polygon.name,
        description: polygon.description,
        data: { geometry: polygon.vertices },
        center: polygon.center.coordinates,
        length: polygon.length,
        area: polygon.area,
        uuid: uuidv4(),
      }))
    );

    polygonsAndLines.push(
      ...(
        await Line.findAll({
          where: {
            data_group_id: id,
          },
        })
      ).map((line: any) => ({
        name: line.name,
        description: line.description,
        data: { geometry: line.vertices },
        length: line.length,
        uuid: uuidv4(),
      }))
    );
  }

  await bulkCreateUpdateAndDeleteMarkers(mapId, markers, false);
  await bulkCreateUpdateAndDeletePolygonsAndLines(
    mapId,
    polygonsAndLines,
    false
  );
};

/** Returns ID of the created map */
export const createMap = async (
  name: string,
  data: SaveMapData,
  userId: number,
  isSnapshot: boolean
): Promise<number> => {
  // Saving drawings to DB separately so can remove from JSON
  const markers = data.markers.markers ?? [];
  const polygonsAndLines =
    data.drawings.drawings ?? data.drawings.polygons ?? [];
  delete data.markers.markers;
  delete data.drawings.polygons;
  delete data.drawings.drawings;

  const myDataLayers = data.mapLayers.myDataLayers;
  if (isSnapshot) data.mapLayers.myDataLayers = [];

  const newMap = await Map.create({
    name: name,
    data: JSON.stringify(data),
    deleted: 0,
    is_snapshot: isSnapshot,
  });

  await UserMap.create({
    map_id: newMap.id,
    user_id: userId,
    access: UserMapAccess.Owner,
  });

  if (isSnapshot) {
    // In old maps, dataLayers used to be array of objects, each with an iddata_groups
    // field. In newer maps, myDataLayers is just an array of data group IDs.
    const dataGroupIds = myDataLayers.map((item: any) =>
      typeof item === "number" ? item : item.iddata_groups
    );
    await copyDataGroupObjectsToNewMap(newMap.id, dataGroupIds);

    // Also, give the markers, polygons and lines new UUIDs so that new ones are created in the DB,
    // rather than just updating the old ones
    markers.forEach((marker) => (marker.uuid = uuidv4()));
    polygonsAndLines.forEach((item) => (item.uuid = uuidv4()));
  }

  await bulkCreateUpdateAndDeleteMarkers(newMap.id, markers, false);
  await bulkCreateUpdateAndDeletePolygonsAndLines(
    newMap.id,
    polygonsAndLines,
    false
  );

  console.log(`Created map ${newMap.id} with name ${name}`);

  trackUserMapEvent(userId, newMap.id, Event.MAP.FIRST_SAVE, {
    // TODO: when we save properties, include this as properties_count
    drawings_count: markers.length + polygonsAndLines.length,
  });
  return newMap.id;
};

export type SaveMapData = {
  map: {
    zoom: [number];
    lngLat: [-1.5, 53];
    searchMarker: [number, number];
    currentLocation: [number, number];
  };
  drawings: {
    drawings?: any[];
    polygons?: any[]; // the old field name in old maps
    activeDrawing: string;
    polygonsDrawn: number;
    linesDrawn: number;
  };
  markers: {
    markers?: any[];
    currentMarker: string;
    markersDrawn: number;
  };
  mapLayers: {
    landDataLayers: string[];
    myDataLayers: string[];
    ownershipDisplay: string;
  };
  version: string;
};

/**
 * Update a map with new data.
 *
 * For each of the markers, polygons and lines in the new data, we assume that new or updated items
 * have a new UUID. Therefore, if an item exists in the DB with the same UUID, we don't update it,
 * otherwise we add it to the DB. And we delete any items with UUIDs that are not in the new data.
 */
export const updateMap = async (userId: number, mapId: number, name: string, data: SaveMapData) => {
  console.log(`User ${userId} updating map ${mapId}`);

  if (data.markers.markers) {
    await bulkCreateUpdateAndDeleteMarkers(mapId, data.markers.markers, true);
  }

  if (data.drawings.drawings) {
    await bulkCreateUpdateAndDeletePolygonsAndLines(
      mapId,
      data.drawings.drawings,
      true
    );
  }

  // Remove markers, polygons and lines from data (for any old maps from before they were stored
  // separately in the DB) since they are now stored separately in the DB
  delete data.markers.markers;
  delete data.drawings.polygons;
  delete data.drawings.drawings;

  // Get the current map data so we can check for what has changed
  const existingMap = await getMap(mapId);
  const existingMapData = JSON.parse(existingMap.data);

  compareMapDataChangesAndSendAnalytics(userId, mapId, existingMapData, data);

  // Save the new map data in the DB
  await Map.update(
    {
      name: name,
      data: JSON.stringify(data),
    },
    {
      where: {
        id: mapId,
      },
    }
  );
};

/**
 * 
 * Changes that we want to track in the map data are:
 * 
 * - setting mapLayers.ownershipDisplay to a non-null value
 *   (this is the only one for now but we may choose to track more later)
 */
const compareMapDataChangesAndSendAnalytics = (
  userId: number,
  mapId: number,
  oldData: SaveMapData,
  newData: SaveMapData
) => {
  const changes = atomizeChangeset(
    diff(oldData, newData, {
      keysToSkip: ["map", "drawings", "markers", "version"],
    })
  );

  const ownershipDisplayChange = changes.find(
    (change) =>
      change.type === "ADD" &&
      change.value !== null &&
      change.path.startsWith("$.mapLayers.ownershipDisplay")
  );

  if (ownershipDisplayChange) {
    trackUserMapEvent(userId, mapId, Event.LAND_OWNERSHIP.ENABLE, {
      layer_id: ownershipDisplayChange.value,
    });
  }
};

export const updateMapZoom = async (mapId: number, zoom: number[]) => {
  const existingMap = await getMap(mapId);
  const mapData = await JSON.parse(existingMap.data);

  // set new zoom
  mapData.map.zoom = zoom;

  await Map.update(
    {
      data: JSON.stringify(mapData),
    },
    {
      where: {
        id: mapId,
      },
    }
  );
};

type MapUpdateLngLatFunction = (eid: number, lngLat: number[]) => Promise<void>;

export const updateMapLngLat: MapUpdateLngLatFunction = async (
  mapId,
  lngLat
) => {
  const existingMap = await getMap(mapId);
  const mapData = await JSON.parse(existingMap.data);

  // set new lnglat
  mapData.map.lngLat = lngLat;

  await Map.update(
    {
      data: JSON.stringify(mapData),
    },
    {
      where: {
        id: mapId,
      },
    }
  );
};

/**
 * Get the email addresses that have been granted access to a map by the owner, and their associated
 * access levels (read-only or read-write). We don't include the owner's email.
 */
export const getUserEmailsWithSharedMapAccess = async (
  mapId: number
): Promise<{ email: string; access: UserMapAccess }[]> => {
  // Since map sharing is stored on both UserMap (for registered users) and PendingUserMap (for
  // non-registered users), perform lookup on both tables

  const userEmails = (
    await UserMap.findAll({
      where: {
        map_id: mapId,
        access: {
          [Op.ne]: UserMapAccess.Owner,
        },
      },
      include: [User],
    })
  ).map((entry: any) => ({
    email: entry.User.username,
    access: entry.access,
  }));

  const pendingUserEmails = (
    await PendingUserMap.findAll({
      where: {
        map_id: mapId,
      },
    })
  ).map((entry: any) => ({
    email: entry.email_address,
    access: entry.access,
  }));

  return [...userEmails, ...pendingUserEmails];
};

/**
 * Takes an array of email addresses and delete their access to a given map id.
 * This method will check and delete both access via user_map and pending_user_map
 */
export const deleteMapAccessByEmails = async (
  mapId: number,
  emails: string[]
) => {
  // Narrow our set of potential UserMaps, so we don't have to perform an expensive search over all
  // usernames
  const potentialUserMaps = await UserMap.findAll({
    where: {
      map_id: mapId,
    },
  });

  const users = await User.findAll({
    where: {
      id: {
        [Op.in]: potentialUserMaps.map((userMap: any) => userMap.user_id),
      },
      username: {
        [Op.in]: emails,
      },
    },
  });

  await UserMap.destroy({
    where: {
      map_id: mapId,
      user_id: {
        [Op.in]: users.map((user: any) => user.id),
      },
    },
  });

  await PendingUserMap.destroy({
    where: {
      map_id: mapId,
      email_address: {
        [Op.in]: emails,
      },
    },
  });
};

/**
 * Takes an array of email addresses and grants their access to a given map id, and revokes access
 * from users that aren't in the array.
 *
 * If the email address corresponds to a user, grant their access via user_map, otherwise via
 * pending_user_map.
 *
 * @param domain this website domain must to be included in order to send email notifications to the
 *               emails that are granted access
 */
export const grantMapAccessByEmails = async (
  mapId: number,
  users: { email: string; access: UserMapAccess }[],
  domain: string = ""
) => {
  // email address comparison should be case insensitive
  const normalisedUsers = users.map(({ email, access }) => ({
    email: email.trim().toLowerCase(),
    access,
  }));

  const oldUsersWithSharedMapAccess: {
    email: string;
    access: UserMapAccess;
  }[] = (await getUserEmailsWithSharedMapAccess(mapId)).map(
    ({ email, access }) => ({
      email: email.toLowerCase(),
      access,
    })
  );

  // Get emails that need to be removed from the DB (access has been completely revoked)
  const emailsToRemove = oldUsersWithSharedMapAccess
    .map((oldUser) => oldUser.email)
    .filter(
      (oldEmail) =>
        !normalisedUsers.map((newUser) => newUser.email).includes(oldEmail)
    );

  await deleteMapAccessByEmails(mapId, emailsToRemove);

  // Get new users or users that have changes to their access level
  const usersToChangeAccess = [];
  const newUsersToGrantAccess = [];

  for (const user of normalisedUsers) {
    const oldUser = oldUsersWithSharedMapAccess.find(
      (oldUser) => oldUser.email === user.email
    );
    if (oldUser) {
      if (oldUser.access !== user.access) {
        usersToChangeAccess.push(user);
      }
    } else {
      newUsersToGrantAccess.push(user);
    }
  }

  const ownerUserMap = await UserMap.findOne({
    where: {
      map_id: mapId,
      access: UserMapAccess.Owner,
    },
    include: [{ model: Map }, { model: User }],
  });
  const ownerUserId = ownerUserMap.User.get("id");
  const ownerFirstName = ownerUserMap.User.get("first_name");
  const ownerLastName = ownerUserMap.User.get("last_name");
  const mapName = ownerUserMap.Map.get("name");

  const sharedWithAnalyticsData: string[] = [];

  for (const userToChangeAccess of usersToChangeAccess) {
    const user = await getUserByEmail(userToChangeAccess.email);

    if (user) {
      // Remove any previous access, to avoid conflicting duplicates
      // TODO: create unique index over (map_id, user_id) on user_map, so we can upsert?
      await UserMap.destroy({
        where: {
          map_id: mapId,
          user_id: user.id,
        },
      });
      await UserMap.create({
        map_id: mapId,
        user_id: user.id,
        access: userToChangeAccess.access,
      });
      sharedWithAnalyticsData.push(await hashUserId(user.id));
    } else {
      // Remove any previous entries, to avoid conflicting duplicates
      await PendingUserMap.destroy({
        where: {
          map_id: mapId,
          email_address: userToChangeAccess.email,
        },
      });
      await PendingUserMap.create({
        map_id: mapId,
        email_address: userToChangeAccess.email,
        access: userToChangeAccess.access,
      });
      sharedWithAnalyticsData.push("PENDING_USER");
    }
  }

  for (const userToGrantAccess of newUsersToGrantAccess) {
    const user = await getUserByEmail(userToGrantAccess.email);

    if (user) {
      await UserMap.create({
        map_id: mapId,
        user_id: user.id,
        access: userToGrantAccess.access,
      });
      if (domain) {
        mailer.shareMapRegistered(
          user.username,
          user.first_name,
          ownerFirstName,
          ownerLastName,
          mapName,
          domain
        );
      }
      sharedWithAnalyticsData.push(await hashUserId(user.id));
    } else {
      await PendingUserMap.create({
        map_id: mapId,
        email_address: userToGrantAccess.email,
        access: userToGrantAccess.access,
      });
      if (domain) {
        mailer.shareMapUnregistered(
          userToGrantAccess.email,
          ownerFirstName,
          ownerLastName,
          mapName,
          domain
        );
      }
      sharedWithAnalyticsData.push("PENDING_USER");
    }
  }

  trackUserMapEvent(ownerUserId, mapId, Event.MAP.SHARE, {
    sharedWith: sharedWithAnalyticsData,
  });
};

/**
 * Make a specified map available to the public.
 * @returns URI for the public map view
 */
export const createPublicMapView = async (mapId: number): Promise<string> => {
  const publicUserId = -1;

  const publicViewExists = await UserMap.findOne({
    where: {
      map_id: mapId,
      user_id: publicUserId,
    },
  });

  if (!publicViewExists) {
    await UserMap.create({
      map_id: mapId,
      user_id: publicUserId,
      access: UserMapAccess.Readonly,
      viewed: 0,
    });
  }

  return `/api/public/map/${mapId}`;
};

/**
 * Get a GeoJSON feature collection containing all the markers, polys and lines in a map, including
 * those in active data groups.
 */
export const getGeoJsonFeaturesForMap = async (mapId: number) => {
  const map = await Map.findOne({
    where: {
      id: mapId,
    },
  });
  const mapData = JSON.parse(map.data);

  // Get markers, polygons and lines that are saved to the map
  const markers = await getMapMarkers(mapId);
  const markerFeatures = markers.map((marker: any) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: marker.coordinates,
    },
    properties: {
      name: marker.name,
      description: marker.description,
      group: "My Drawings",
    },
  }));

  const polygonsAndLines = await getMapPolygonsAndLines(mapId);
  const polygonAndLineFeatures = polygonsAndLines.map((polygon: any) => ({
    ...polygon.data,
    properties: {
      name: polygon.name,
      description: polygon.description,
      group: "My Drawings",
    },
  }));

  // Get features from datagroup layers which are active
  const dataGroupFeatures: any[] = [];
  for (const dataGroupId of mapData.mapLayers.myDataLayers) {
    const dataGroup = await DataGroup.findOne({
      where: {
        // In old maps, myDataLayers used to be array of objects, each with an iddata_groups
        // field. In newer maps, myDataLayers is just an array of data group IDs.
        iddata_groups: dataGroupId.iddata_groups || dataGroupId,
      },
    });
    const dataGroupMarkers = await Marker.findAll({
      where: {
        data_group_id: dataGroupId.iddata_groups || dataGroupId,
      },
    });
    const dataGroupPolygons = await Polygon.findAll({
      where: {
        data_group_id: dataGroupId.iddata_groups || dataGroupId,
      },
    });
    const dataGroupLines = await Line.findAll({
      where: {
        data_group_id: dataGroupId.iddata_groups || dataGroupId,
      },
    });

    dataGroupMarkers.forEach((marker: any) => {
      dataGroupFeatures.push({
        type: "Feature",
        geometry: marker.location,
        properties: {
          name: marker.name,
          description: marker.description,
          group: dataGroup.title,
        },
      });
    });
    dataGroupPolygons.forEach((polygon: any) => {
      dataGroupFeatures.push({
        type: "Feature",
        geometry: polygon.vertices,
        properties: {
          name: polygon.name,
          description: polygon.description,
          group: dataGroup.title,
        },
      });
    });
    dataGroupLines.forEach((line: any) => {
      dataGroupFeatures.push({
        type: "Feature",
        geometry: line.vertices,
        properties: {
          name: line.name,
          description: line.description,
          group: dataGroup.title,
        },
      });
    });
  }

  return {
    type: "FeatureCollection",
    features: [
      ...markerFeatures,
      ...polygonAndLineFeatures,
      ...dataGroupFeatures,
    ],
  };
};
