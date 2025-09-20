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
} from "./database";
import { createMarker, createPolygon, createLine } from "./object";
import { Op } from "sequelize";
import { createHash } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { getUserByEmail, hashUserId, trackUserEvent } from "./query";
import * as mailer from "./mails";
import { Event, EventName } from "../instrument";

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
  markers.push(...mapData.markers.markers);

  console.log(`Got ${markers.length} markers for map ${mapId}`);
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
  polygonsAndLines.push(...mapData.drawings.polygons);

  const numPolygons = polygonsAndLines.filter(
    (p) => p.type === "Polygon"
  ).length;
  const numLines = polygonsAndLines.length - numPolygons;
  console.log(
    `Got ${numPolygons} polygons and ${numLines} lines for map ${mapId}`
  );

  return polygonsAndLines;
};

export const createMapMembership = async (
  mapId: number,
  itemTypeId: number,
  itemId: number
) => {
  await MapMembership.create({
    map_id: mapId,
    item_type_id: itemTypeId,
    item_id: itemId,
  });
};

/* Save array of markers to DB for a given map. */
const saveMarkers = async (
  mapId: number,
  markers: Array<any>,
  update: boolean
) => {
  for (const m of markers) {
    const uuid = update && m.uuid ? m.uuid : uuidv4();
    const newMarker = await createMarker(
      m.name,
      m.description,
      m.coordinates,
      uuid
    );
    await createMapMembership(mapId, ItemTypeId.Marker, newMarker.idmarkers);
  }
};

/* Save array of polygons and lines to DB for a given map. */
const savePolygonsAndLines = async (
  mapId: number,
  polygonsAndLines: Array<any>,
  update: boolean
) => {
  for (const p of polygonsAndLines) {
    const uuid = update && p.data.id ? p.data.id : uuidv4();

    if (p.type === "Polygon") {
      const newPolygon = await createPolygon(
        p.name,
        p.description,
        p.data.geometry.coordinates,
        p.center,
        p.length,
        p.area,
        uuid
      );
      await createMapMembership(
        mapId,
        ItemTypeId.Polygon,
        newPolygon.idpolygons
      );
    } else {
      const newLine = await createLine(
        p.name,
        p.description,
        p.data.geometry.coordinates,
        p.length,
        uuid
      );
      await createMapMembership(mapId, ItemTypeId.Line, newLine.idlinestrings);
    }
  }
};

/* Copy all data group objects to a specified map. */
const copyDataGroupObjects = async (mapId: number, dataGroupIds: any) => {
  for (const id of dataGroupIds) {
    const dataGroupMarkers = await Marker.findAll({
      where: {
        data_group_id: id,
      },
    });
    await saveMarkers(
      mapId,
      dataGroupMarkers.map((marker: any) => ({
        name: marker.name,
        description: marker.description,
        coordinates: marker.location.coordinates,
      })),
      false
    );

    const dataGroupPolygons = await Polygon.findAll({
      where: {
        data_group_id: id,
      },
    });
    for (const polygon of dataGroupPolygons) {
      const newPolygon = await createPolygon(
        polygon.name,
        polygon.description,
        polygon.vertices.coordinates,
        polygon.center.coordinates,
        polygon.length,
        polygon.area,
        uuidv4()
      );
      await createMapMembership(
        mapId,
        ItemTypeId.Polygon,
        newPolygon.idpolygons
      );
    }

    const dataGroupLines = await Line.findAll({
      where: {
        data_group_id: id,
      },
    });
    for (const line of dataGroupLines) {
      const newLine = await createLine(
        line.name,
        line.description,
        line.vertices.coordinates,
        line.length,
        uuidv4()
      );
      await createMapMembership(mapId, ItemTypeId.Line, newLine.idlinestrings);
    }
  }
};

type CreateMapFunction = (
  name: string,
  data: any,
  userId: number,
  isSnapshot: boolean
) => Promise<number>;

/** Returns ID of the created map */
export const createMap: CreateMapFunction = async (
  name,
  data,
  userId,
  isSnapshot
) => {
  const mapData = await JSON.parse(data);

  // Saving drawings to DB separately so can remove from JSON
  const markers = mapData.markers.markers;
  const polygonsAndLines = mapData.drawings.polygons;
  mapData.markers.markers = [];
  mapData.drawings.polygons = [];

  const myDataLayers = JSON.parse(
    JSON.stringify(mapData.mapLayers.myDataLayers)
  );
  if (isSnapshot) mapData.mapLayers.myDataLayers = [];

  const newMap = await Map.create({
    name: name,
    data: JSON.stringify(mapData),
    deleted: 0,
    is_snapshot: isSnapshot,
  });

  await UserMap.create({
    map_id: newMap.id,
    user_id: userId,
    access: UserMapAccess.Owner,
  });

  await saveMarkers(newMap.id, markers, false);

  await savePolygonsAndLines(newMap.id, polygonsAndLines, false);

  if (isSnapshot) {
    // In old maps, dataLayers used to be array of objects, each with an iddata_groups
    // field. In newer maps, myDataLayers is just an array of data group IDs.
    const dataGroupIds = myDataLayers.map((item: any) =>
      typeof item === "number" ? item : item.iddata_groups
    );

    await copyDataGroupObjects(newMap.id, dataGroupIds);
  }

  console.log(`Created map ${newMap.id} with name ${name}`);

  trackUserMapEvent(userId, newMap.id, Event.MAP.FIRST_SAVE, {
    // TODO: when we save properties, include this as properties_count
    drawings_count: markers.length + polygonsAndLines.length,
  });
  return newMap.id;
};

type MapUpdateFunction = (
  eid: number,
  name: string,
  data: any
) => Promise<void>;

export const updateMap: MapUpdateFunction = async (mapId, name, data) => {
  console.log(`Updating map ${mapId}`);
  const mapData = await JSON.parse(data);

  // Remove existing objects in DB and re-add them.
  // TODO: Reduce number of DB operations by only adding and removing objects that have changed

  const mapMemberships = await MapMembership.findAll({
    where: { map_id: mapId },
  });

  const markerIds = [];
  const polygonIds = [];
  const lineIds = [];
  for (const item of mapMemberships) {
    switch (item.item_type_id) {
      case ItemTypeId.Marker:
        markerIds.push(item.item_id);
      case ItemTypeId.Polygon:
        polygonIds.push(item.item_id);
      case ItemTypeId.Line:
        lineIds.push(item.item_id);
    }
  }

  await MapMembership.destroy({
    where: { map_id: mapId },
  });

  if (markerIds.length) {
    console.log(
      `Removing ${markerIds.length} markers from DB for map ${mapId}`
    );
    await Marker.destroy({
      where: { idmarkers: markerIds },
    });
  }

  if (polygonIds.length) {
    console.log(
      `Removing ${polygonIds.length} polygons from DB for map ${mapId}`
    );
    await Polygon.destroy({
      where: { idpolygons: polygonIds },
    });
  }

  if (lineIds.length) {
    console.log(`Removing ${lineIds.length} lines from DB for map ${mapId}`);
    await Line.destroy({
      where: { idlinestrings: lineIds },
    });
  }

  console.log(
    `Adding ${mapData.markers.markers.length} markers to DB for map ${mapId}`
  );
  await saveMarkers(mapId, mapData.markers.markers, true);
  console.log(
    `Adding ${mapData.drawings.polygons.length} polygons/lines to DB for map ${mapId}`
  );
  await savePolygonsAndLines(mapId, mapData.drawings.polygons, true);

  // Remove drawings from data since they are now in the DB
  mapData.markers.markers = [];
  mapData.drawings.polygons = [];

  await Map.update(
    {
      name: name,
      data: JSON.stringify(mapData),
    },
    {
      where: {
        id: mapId,
      },
    }
  );
};

type MapUpdateZoomFunction = (eid: number, zoom: number[]) => Promise<void>;

export const updateMapZoom: MapUpdateZoomFunction = async (mapId, zoom) => {
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
