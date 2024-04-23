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
} from "./database";
import { createMarker, createPolygon, createLine } from "./object";
import { Op } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import { getUserByEmail } from "./query";
import * as mailer from "./mails";

const getMap = async (mapId: number) =>
  await Map.findOne({
    where: {
      id: mapId,
    },
  });

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

  await MapMembership.destroy({
    where: { map_id: mapId },
  });

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
 * Takes an array of email addresses and grants their access to a given map id.
 *
 * If the email address corresponds to a user, grant their access via user_map, otherwise via
 * pending_user_map.
 *
 * @param sendEmailNotification whether to send an email to the emails that are granted access
 * @param domain if sendEmailNotification is true, this website domain must to be included
 */
export const grantMapAccessByEmails = async (
  mapId: number,
  users: { email: string; access: UserMapAccess }[],
  sendEmailNotification: boolean,
  domain: string = ""
) => {
  let ownerFirstName: string;
  let ownerLastName: string;
  let mapName: string;

  if (sendEmailNotification && domain) {
    const ownerUserMap = await UserMap.findOne({
      where: {
        map_id: mapId,
        access: UserMapAccess.Owner,
      },
      include: [{ model: Map }, { model: User }],
    });
    ownerFirstName = ownerUserMap.User.get("first_name");
    ownerLastName = ownerUserMap.User.get("last_name");
    mapName = ownerUserMap.Map.get("name");
  }

  for (const { email, access } of users) {
    const user = await getUserByEmail(email);

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
        access,
      });

      if (sendEmailNotification && domain) {
        mailer.shareMapRegistered(
          user.username,
          user.first_name,
          ownerFirstName!!,
          ownerLastName!!,
          mapName!!,
          domain
        );
      }
    } else {
      // Remove any previous entries, to avoid conflicting duplicates
      await PendingUserMap.destroy({
        where: {
          map_id: mapId,
          email_address: email,
        },
      });
      await PendingUserMap.create({
        map_id: mapId,
        email_address: email,
        access,
      });

      if (sendEmailNotification && domain) {
        mailer.shareMapUnregistered(
          email,
          ownerFirstName!!,
          ownerLastName!!,
          mapName!!,
          domain
        );
      }
    }
  }
};
