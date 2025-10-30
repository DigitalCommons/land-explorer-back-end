import {
  Request,
  ResponseToolkit,
  ResponseObject,
  ServerRoute,
} from "@hapi/hapi";
import { Op } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import { Validation } from "../validation";
import { getPolygons, searchOwner, trackUserEvent } from "../queries/query";
import {
  createMap,
  updateMap,
  updateMapZoom,
  updateMapLngLat,
  getMapMarkers,
  bulkCreateMapMemberships,
  getMapPolygonsAndLines,
  getUserEmailsWithSharedMapAccess,
  grantMapAccessByEmails,
  trackUserMapEvent,
  createPublicMapView,
  getGeoJsonFeaturesForMap,
  SaveMapData,
} from "../queries/map";
import {
  createMarker,
  createPolygon,
  createLine,
  updateMarker,
  updatePolygon,
  updateLine,
} from "../queries/object";
import { Map, User, UserMap, UserMapAccess } from "../queries/database";
import { ItemType } from "../enums";
import { EventEmitter } from "events";
import { tryLockMap } from "../websockets/locking";
import { Event } from "../instrument";
import { LoggedInRequest } from "./request_types";

const eventEmitter = new EventEmitter();

eventEmitter.on("error", (error) => {
  console.error("Error occurred: ", error);
});

eventEmitter.emit("message", "Hello world!");

type SaveMapRequest = LoggedInRequest & {
  payload: {
    eid: number | null;
    name: string;
    data: SaveMapData;
    isSnapshot: boolean;
  };
};

/**
 * Endpoint for user to update or create new map.
 * When "eid" field is provided as part of payload, it means map update.
 * If "eid" is null, create a new map.
 */
async function saveMap(
  request: SaveMapRequest,
  h: ResponseToolkit,
  d: any
): Promise<ResponseObject> {
  try {
    const { eid, name, data, isSnapshot } = request.payload;
    const userId = request.auth.credentials.user_id;

    // eid provided means update map
    const isUpdate = eid !== null;

    if (isUpdate) {
      // check that the map exists and isn't a snapshot
      const existsAndEditable = await Map.findOne({
        where: {
          id: eid,
          is_snapshot: { [Op.or]: [false, null] },
        },
      });

      if (existsAndEditable === null) {
        return h.response("Map not found").code(404);
      }

      // check that user has permission to update the map
      const hasAccess = await UserMap.findOne({
        where: {
          map_id: eid,
          access: { [Op.or]: [UserMapAccess.Readwrite, UserMapAccess.Owner] },
          user_id: userId,
        },
      });

      if (hasAccess === null) {
        return h.response("Unauthorised").code(403);
      }

      // Try to acquire lock for user
      const success = await tryLockMap(eid, userId);
      if (!success) {
        return h.response("Map is locked").code(503);
      }

      await updateMap(userId, eid, name, data);
    } else {
      const newMapId = await createMap(name, data, userId, isSnapshot);
      await tryLockMap(newMapId, userId);
    }

    return h.response().code(200);
  } catch (error) {
    console.error("Error in saveMap:", error);
    return h.response("Internal server error").code(500);
  }
}

type SaveMapObjectRequest = LoggedInRequest & {
  payload: {
    object: {
      name: string;
      description: string;
      vertices: number[][];
      center: number[];
      length: number;
      area: number;
    };
    eid: number;
  };
};

async function saveMapMarker(
  request: SaveMapObjectRequest,
  h: ResponseToolkit,
  d: any
): Promise<ResponseObject> {
  try {
    const { object, eid } = request.payload;

    // check that user has permission to update this map
    const hasAccess = await UserMap.findOne({
      where: {
        map_id: eid,
        access: { [Op.or]: [UserMapAccess.Readwrite, UserMapAccess.Owner] },
        user_id: request.auth.credentials.user_id,
      },
    });
    if (hasAccess === null) {
      return h.response("Unauthorised").code(403);
    }

    // Try to acquire lock for user
    const success = await tryLockMap(eid, request.auth.credentials.user_id);
    if (!success) {
      return h.response("Map is locked").code(503);
    }

    const newMarker = await createMarker(
      object.name,
      object.description,
      object.center,
      uuidv4()
    );
    await bulkCreateMapMemberships(eid, ItemType.Marker, newMarker.idmarkers);

    return h.response();
  } catch (error) {
    console.error("Error in saveMapMarker:", error);
    return h.response("Internal server error").code(500);
  }
}

async function saveMapPolygon(
  request: SaveMapObjectRequest,
  h: ResponseToolkit,
  d: any
): Promise<ResponseObject> {
  const { object, eid } = request.payload;

  // check that user has permission to update this map
  const hasAccess = await UserMap.findOne({
    where: {
      map_id: eid,
      access: { [Op.or]: [UserMapAccess.Readwrite, UserMapAccess.Owner] },
      user_id: request.auth.credentials.user_id,
    },
  });
  if (hasAccess === null) {
    return h.response("Unauthorised").code(403);
  }

  // Try to acquire lock for user
  const success = await tryLockMap(eid, request.auth.credentials.user_id);
  if (!success) {
    return h.response("Map is locked").code(503);
  }

  const newPolygon = await createPolygon(
    object.name,
    object.description,
    object.vertices,
    object.center,
    object.length,
    object.area,
    uuidv4()
  );
  await bulkCreateMapMemberships(eid, ItemType.Polygon, newPolygon.idpolygons);

  return h.response();
}

async function saveMapLine(
  request: SaveMapObjectRequest,
  h: ResponseToolkit,
  d: any
): Promise<ResponseObject> {
  const { object, eid } = request.payload;

  // check that user has permission to update this map
  const hasAccess = await UserMap.findOne({
    where: {
      map_id: eid,
      access: { [Op.or]: [UserMapAccess.Readwrite, UserMapAccess.Owner] },
      user_id: request.auth.credentials.user_id,
    },
  });
  if (hasAccess === null) {
    return h.response("Unauthorised").code(403);
  }

  // Try to acquire lock for user
  const success = await tryLockMap(eid, request.auth.credentials.user_id);
  if (!success) {
    return h.response("Map is locked").code(503);
  }

  const newLine = await createLine(
    object.name,
    object.description,
    object.vertices,
    object.length,
    uuidv4()
  );
  await bulkCreateMapMemberships(eid, ItemType.Line, newLine.idlinestrings);

  return h.response();
}

type SaveMapZoomRequest = LoggedInRequest & {
  payload: {
    eid: number;
    zoom: number[];
  };
};

async function saveMapZoom(
  request: SaveMapZoomRequest,
  h: ResponseToolkit,
  d: any
): Promise<ResponseObject> {
  const { eid, zoom } = request.payload;

  // check that user has permission to update this map
  const hasAccess = await UserMap.findOne({
    where: {
      map_id: eid,
      access: { [Op.or]: [UserMapAccess.Readwrite, UserMapAccess.Owner] },
      user_id: request.auth.credentials.user_id,
    },
  });
  if (hasAccess === null) {
    return h.response("Unauthorised").code(403);
  }

  await updateMapZoom(eid, zoom);

  return h.response();
}

type SaveMapLngLatRequest = LoggedInRequest & {
  payload: {
    eid: number;
    lngLat: number[];
  };
};

async function saveMapLngLat(
  request: SaveMapLngLatRequest,
  h: ResponseToolkit,
  d: any
): Promise<ResponseObject> {
  const { eid, lngLat } = request.payload;

  // check that user has permission to update this map
  const hasAccess = await UserMap.findOne({
    where: {
      map_id: eid,
      access: { [Op.or]: [UserMapAccess.Readwrite, UserMapAccess.Owner] },
      user_id: request.auth.credentials.user_id,
    },
  });
  if (hasAccess === null) {
    return h.response("Unauthorised").code(403);
  }

  await updateMapLngLat(eid, lngLat);

  return h.response();
}

type EditRequest = LoggedInRequest & {
  payload: {
    eid: number;
    uuid: string;
    name: string;
    description: string;
  };
};

/**
 * This API can be used to edit the title/description of a map marker.
 *
 * The edit will fail if the user doesn't have write access to the map, or if the map is locked.
 */
async function editMapMarker(
  request: EditRequest,
  h: ResponseToolkit
): Promise<ResponseObject> {
  const { uuid, name, description, eid } = request.payload;

  // check that user has permission to update this map
  const hasAccess = await UserMap.findOne({
    where: {
      map_id: eid,
      access: { [Op.or]: [UserMapAccess.Readwrite, UserMapAccess.Owner] },
      user_id: request.auth.credentials.user_id,
    },
  });
  if (hasAccess === null) {
    return h.response("Unauthorised").code(403);
  }

  const success = await tryLockMap(eid, request.auth.credentials.user_id);
  if (!success) {
    return h.response("Map is locked").code(503);
  }

  await updateMarker(uuid, name, description);

  return h.response();
}

async function editMapPolygon(
  request: EditRequest,
  h: ResponseToolkit
): Promise<ResponseObject> {
  const { uuid, name, description, eid } = request.payload;

  // check that user has permission to update this map
  const hasAccess = await UserMap.findOne({
    where: {
      map_id: eid,
      access: { [Op.or]: [UserMapAccess.Readwrite, UserMapAccess.Owner] },
      user_id: request.auth.credentials.user_id,
    },
  });
  if (hasAccess === null) {
    return h.response("Unauthorised").code(403);
  }

  const success = await tryLockMap(eid, request.auth.credentials.user_id);
  if (!success) {
    return h.response("Map is locked").code(503);
  }

  await updatePolygon(uuid, name, description);

  return h.response();
}

async function editMapLine(
  request: EditRequest,
  h: ResponseToolkit
): Promise<ResponseObject> {
  const { uuid, name, description, eid } = request.payload;

  // check that user has permission to update this map
  const hasAccess = await UserMap.findOne({
    where: {
      map_id: eid,
      access: { [Op.or]: [UserMapAccess.Readwrite, UserMapAccess.Owner] },
      user_id: request.auth.credentials.user_id,
    },
  });
  if (hasAccess === null) {
    return h.response("Unauthorised").code(403);
  }

  const success = await tryLockMap(eid, request.auth.credentials.user_id);
  if (!success) {
    return h.response("Map is locked").code(503);
  }

  await updateLine(uuid, name, description);

  return h.response();
}

/**
 * Set a map as viewed.
 * TODO: remove this API since we get same info from websocket connections anyway?
 */
async function setMapAsViewed(
  request: Request,
  h: ResponseToolkit
): Promise<ResponseObject> {
  let validation = new Validation();
  await validation.validateEid(request.payload);

  if (validation.fail()) {
    return h.response(validation.errors).code(400);
  }

  let payload: any = request.payload;

  await UserMap.update(
    {
      viewed: 1,
    },
    {
      where: {
        user_id: request.auth.credentials.user_id,
        map_id: payload.eid,
      },
    }
  );

  return h.response().code(200);
}

type GetMapSharedToRequest = LoggedInRequest & {
  params: {
    eid: number;
  };
};

/**
 * Returns the list of email addresses that a map has been shared to, and their access level.
 * This API can only be called by owners of the map.
 */
async function getMapSharedTo(
  request: GetMapSharedToRequest,
  h: ResponseToolkit
): Promise<ResponseObject> {
  const { eid } = request.params;

  let userMap = await UserMap.findOne({
    where: {
      user_id: request.auth.credentials.user_id,
      map_id: eid,
    },
    include: [{ model: Map }, { model: User }],
  });

  if (!userMap || userMap.Map.deleted) {
    return h.response("Map not found").code(404);
  }

  if (userMap.access !== UserMapAccess.Owner) {
    return h.response("Unauthorised!").code(403);
  }

  const userEmailsWithSharedMapAccess: {
    email: string;
    access: UserMapAccess;
  }[] = await getUserEmailsWithSharedMapAccess(eid);

  return h.response(userEmailsWithSharedMapAccess);
}

type ShareMapRequest = LoggedInRequest & {
  payload: {
    eid: number;
    users: { email: string; access: UserMapAccess }[];
  };
};

/**
 * A method to share access of a map to a list of email addresses
 * Email address may or may not be a registered LX user and needs to be handled accordingly.
 * Email address given may already be recorded in the database (do not resend email invitation).
 */
async function shareMap(
  request: ShareMapRequest,
  h: ResponseToolkit
): Promise<ResponseObject> {
  const originDomain = `https://${request.info.host}`;

  const validation = new Validation();
  await validation.validateShareMap(request.payload);

  if (validation.fail()) {
    return h.response(validation.errors).code(400);
  }

  const { eid, users } = request.payload;

  let userMap = await UserMap.findOne({
    where: {
      user_id: request.auth.credentials.user_id,
      map_id: eid,
    },
    include: [{ model: Map }, { model: User }],
  });

  if (!userMap || userMap.Map.deleted) {
    return h.response("Map not found").code(404);
  }

  if (userMap.access !== UserMapAccess.Owner) {
    return h.response("Unauthorised!").code(403);
  }

  await grantMapAccessByEmails(eid, users, originDomain);

  return h.response().code(200);
}

/**
 * Soft delete a map owned by user.
 *
 * @param request
 * @param h
 * @param d
 * @returns
 */
async function deleteMap(
  request: Request,
  h: ResponseToolkit,
  d: any
): Promise<ResponseObject> {
  let validation = new Validation();
  await validation.validateEid(request.payload);

  if (validation.fail()) {
    return h.response(validation.errors).code(400);
  }

  let payload: any = request.payload;

  let userMap = await UserMap.findOne({
    where: {
      user_id: request.auth.credentials.user_id,
      map_id: payload.eid,
    },
    include: [Map, User],
  });

  if (!userMap || userMap.Map.deleted) {
    return h.response("Map not found").code(404);
  }

  if (userMap.access !== UserMapAccess.Owner) {
    return h.response("Unauthorised!").code(403);
  }

  await Map.update(
    {
      deleted: 1,
    },
    {
      where: {
        id: payload.eid,
      },
    }
  );

  return h.response().code(200);
}

/**
 * Get all maps owned by or shared to user, in order of creation (oldest first).
 *
 * Returns lightweight list of metadata without full map data, in order of map creation date, oldest
 * to newest.
 */
async function getUserMaps(
  request: Request,
  h: ResponseToolkit,
  d: any
): Promise<ResponseObject> {
  try {
    const userId = request.auth.credentials.user_id;

    const allMaps = await Map.findAll({
      where: {
        "$UserMaps.user_id$": userId,
        deleted: 0,
      },
      include: [
        {
          model: UserMap,
          as: "UserMaps",
        },
      ],
      order: [
        ["id", "ASC"],
        [UserMap, "access", "ASC"],
      ],
    });

    const allMapsData = [];

    for (const map of allMaps) {
      const myUserMap = map.UserMaps[0];
      let sharedWith: { email: string; access: UserMapAccess }[] = [];

      // If we are the owner, get emails with whom we have shared this map
      if (myUserMap.access === UserMapAccess.Owner) {
        sharedWith = await getUserEmailsWithSharedMapAccess(map.id);
      }

      allMapsData.push({
        eid: map.id,
        name: map.name,
        createdDate: map.created_date,
        lastModified: map.last_modified,
        sharedWith: sharedWith,
        isSnapshot: map.is_snapshot,
        accessGrantedDate: myUserMap.created_date,
        access: myUserMap.access,
        viewed: myUserMap.viewed == 1,
      });
    }

    return h.response(allMapsData).code(200);
  } catch (error) {
    console.error("Error in getUserMaps:", error);
    return h.response("Internal server error").code(500);
  }
}

type GetMapDataRequest = LoggedInRequest & {
  params: {
    eid: number;
  };
};

/**
 * Get full map data for a specific map by eid.
 * User must have access to the map.
 */
async function getMapData(
  request: GetMapDataRequest,
  h: ResponseToolkit
): Promise<ResponseObject> {
  try {
    const { eid } = request.params;
    const userId = request.auth.credentials.user_id;

    const userMap = await UserMap.findOne({
      where: {
        user_id: userId,
        map_id: eid,
      },
      include: [
        {
          model: Map,
          where: {
            deleted: 0,
          },
        },
      ],
    });

    if (!userMap || !userMap.Map) {
      return h.response("Map not found").code(404);
    }

    const map = userMap.Map;
    const mapData = await JSON.parse(map.data);

    // get all drawings, including those in separate DB tables
    mapData.markers.markers = await getMapMarkers(map.id);
    mapData.drawings.drawings = await getMapPolygonsAndLines(map.id);
    delete mapData.drawings.polygons; // this was the old field name for polygon/line drawings

    // landDataLayers field used to be called activeLayers
    if (mapData.mapLayers.activeLayers) {
      mapData.mapLayers.landDataLayers = mapData.mapLayers.activeLayers;
      delete mapData.mapLayers.activeLayers;
    }
    // fix that some old maps may not have dataLayers field
    if (!mapData.mapLayers.myDataLayers) {
      mapData.mapLayers.myDataLayers = [];
    }

    return h.response(mapData).code(200);
  } catch (error) {
    console.error("Error in getMapData:", error);
    return h.response("Internal server error").code(500);
  }
}

type GetLandOwnershipPolygonsRequest = LoggedInRequest & {
  query: {
    sw_lng: number;
    sw_lat: number;
    ne_lng: number;
    ne_lat: number;
    /**
     * The type of ownership to return, one of "all", "localAuthority", "churchOfEngland",
     * "pending", or "unregistered". The latter is regions of land that have no registered
     * ownership.
     */
    type?: string;
    /**
     * Only matters if type is "pending". If true, only return pending polys marked as accepted.
     */
    acceptedOnly?: boolean;
  };
};

/**
 * Get the geojson polygons of land ownership within a given bounding box area
 */
async function getLandOwnershipPolygons(
  request: GetLandOwnershipPolygonsRequest,
  h: ResponseToolkit,
  d: any
): Promise<ResponseObject> {
  const { sw_lng, sw_lat, ne_lng, ne_lat, type, acceptedOnly } = request.query;
  const { user_id } = request.auth.credentials;
  let polygons;

  switch (type) {
    case "all":
    case undefined:
    case "localAuthority":
    case "churchOfEngland":
      polygons = await getPolygons(sw_lng, sw_lat, ne_lng, ne_lat, type);
      return h.response(polygons).code(200);
    case "unregistered":
      polygons = (await getPolygons(sw_lng, sw_lat, ne_lng, ne_lat, type)).map(
        (polygon) => ({
          ...polygon,
          // Add tenure field which is used by front-end
          tenure: "unregistered",
          // Add U prefix to ID to avoid conflicts with actual poly_ids
          poly_id: `U${polygon.poly_id}`,
        })
      );
      return h.response(polygons).code(200);
    case "pending":
      // These are the new boundaries from the latest INSPIRE pipeline run that are waiting to be
      // permanently saved. Only super users should be able to view pending polygons.
      const hasAccess = await User.findOne({
        where: {
          id: user_id,
          is_super_user: true,
        },
      });
      if (!hasAccess) {
        return h.response("Unauthorised!").code(403);
      }

      polygons = await getPolygons(
        sw_lng,
        sw_lat,
        ne_lng,
        ne_lat,
        type,
        acceptedOnly
      );
      // Add "-pending" to the end of each poly_id to avoid id conflicts with normal polygons
      polygons.forEach((poly) => {
        poly.poly_id = `${poly.poly_id}-pending`;
      });
      return h.response(polygons).code(200);
    default:
      return h.response("unknown ownership type").code(400);
  }
}

/**
 * Perform a backsearch, to find all properties owned by a given owner.
 */
async function searchOwnership(
  request: LoggedInRequest,
  h: ResponseToolkit
): Promise<ResponseObject> {
  const { proprietorName } = request.query;
  const { user_id } = request.auth.credentials;

  const polygonsAndOwnerships = await searchOwner(proprietorName);

  trackUserEvent(user_id, Event.LAND_OWNERSHIP.BACKSEARCH, {
    proprietor_name: proprietorName,
    properties_count: polygonsAndOwnerships.length,
  });

  return h.response(polygonsAndOwnerships).code(200);
}

type PublicMapRequest = LoggedInRequest & {
  payload: {
    mapId: number;
  };
};

type FileResponseToolkit = ResponseToolkit & {
  file: Function;
};

async function downloadShapefile(
  request: PublicMapRequest,
  h: FileResponseToolkit
): Promise<ResponseObject> {
  const { mapId } = request.params;
  const { user_id } = request.auth.credentials;

  const hasAccess = await UserMap.findOne({
    where: {
      user_id,
      map_id: mapId,
    },
  });
  if (!hasAccess) {
    return h.response("Unauthorised!").code(403);
  }

  const features = await getGeoJsonFeaturesForMap(mapId);

  const shapeFileDirectory = "./data/shapefiles";
  const shapeFileLocation = `${shapeFileDirectory}/Map-${mapId}-${Date.now()}.zip`;

  const fs = require("fs");

  fs.mkdir(shapeFileDirectory, { recursive: true }, (error: any) => {
    if (error) throw error;
  });

  const { convert } = require("geojson2shp");
  // geojson2shp writing to file path isn't working so create our own write stream
  const outStream = fs.createWriteStream(shapeFileLocation);
  const convertOptions = {
    layer: "land-explorer-layer",
    targetCrs: 2154,
    encoding: "latin1",
  };
  // create a new shapefile in the shape file location
  await convert(features, outStream, convertOptions);

  const response = h.file(shapeFileLocation, {
    mode: "attachment",
  });

  const deleteFile = () => {
    fs.unlink(shapeFileLocation, (error: any) => {
      if (error) throw error;
    });
  };

  setTimeout(deleteFile, 5000);

  trackUserMapEvent(user_id, mapId, Event.MAP.EXPORT_SHAPEFILE);

  return response;
}

async function createMapGeoJSONLink(
  request: PublicMapRequest,
  h: ResponseToolkit
): Promise<ResponseObject> {
  const { mapId } = request.payload;
  const { user_id } = request.auth.credentials;

  const userMapView = await UserMap.findOne({
    where: {
      map_id: mapId,
      user_id: user_id,
    },
  });

  if (userMapView?.access === UserMapAccess.Owner) {
    const publicMapAddress = await createPublicMapView(mapId);

    trackUserMapEvent(user_id, mapId, Event.MAP.EXPORT_GEOJSON);

    return h.response(publicMapAddress);
  } else {
    return h
      .response("You don't own this map, so can't make it public.")
      .code(403);
  }
}

async function getPublicMap(
  request: Request,
  h: ResponseToolkit
): Promise<ResponseObject> {
  const { mapId } = request.params;

  const publicMapView = await UserMap.findOne({
    where: {
      map_id: mapId,
      user_id: -1, // public user ID
    },
  });

  if (publicMapView) {
    const geoJsonData = await getGeoJsonFeaturesForMap(mapId);
    trackUserMapEvent(-1, mapId, Event.MAP.GEOJSON_OPEN);
    return h.response(geoJsonData);
  } else {
    return h.response("No public map at this address.").code(404);
  }
}

export const mapRoutes: ServerRoute[] = [
  // Create or update a map
  { method: "POST", path: "/api/user/map/save", handler: saveMap },
  // Save an object to a map
  { method: "POST", path: "/api/user/map/save/marker", handler: saveMapMarker },
  {
    method: "POST",
    path: "/api/user/map/save/polygon",
    handler: saveMapPolygon,
  },
  { method: "POST", path: "/api/user/map/save/line", handler: saveMapLine },
  // Save the zoom level of a map
  { method: "POST", path: "/api/user/map/save/zoom", handler: saveMapZoom },
  // Save the longitude and latitude of a map (i.e. when the frame is moved)
  { method: "POST", path: "/api/user/map/save/lngLat", handler: saveMapLngLat },
  // Edit an object
  { method: "POST", path: "/api/user/map/edit/marker", handler: editMapMarker },
  {
    method: "POST",
    path: "/api/user/map/edit/polygon",
    handler: editMapPolygon,
  },
  { method: "POST", path: "/api/user/map/edit/line", handler: editMapLine },
  // Record that the user has viewed a map
  { method: "POST", path: "/api/user/map/view", handler: setMapAsViewed },
  // Get the email addresses and their access level that a map is shared to
  { method: "GET", path: "/api/user/map/share", handler: getMapSharedTo },
  // Share access of a map to a list of email addresses
  { method: "POST", path: "/api/user/map/share/sync", handler: shareMap },
  // Delete a map
  { method: "POST", path: "/api/user/map/delete", handler: deleteMap },
  // Make a map GeoJSON accessible to the public via a link
  {
    method: "POST",
    path: "/api/user/map/share/public",
    handler: createMapGeoJSONLink,
  },
  // Get a public map GeoJSON
  {
    method: "GET",
    path: "/api/public/map/{mapId}",
    handler: getPublicMap,
    options: { auth: false },
  },
  // Returns a map converted to shapefile format
  {
    method: "GET",
    path: "/api/user/map/download/{mapId}",
    handler: downloadShapefile,
  },
  // Returns a list of all maps that the user has access to
  { method: "GET", path: "/api/user/maps", handler: getUserMaps },
  // Get full data for a specific map by eid
  { method: "GET", path: "/api/user/map/{eid}", handler: getMapData },
  // Get the geojson polygons of land ownership within a given bounding box area
  { method: "GET", path: "/api/ownership", handler: getLandOwnershipPolygons },
  // search the public ownership information
  { method: "GET", path: "/api/search", handler: searchOwnership },
];
