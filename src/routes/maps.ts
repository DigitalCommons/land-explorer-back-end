import {
  Request,
  ResponseToolkit,
  ResponseObject,
  ServerRoute,
} from "@hapi/hapi";
import { Op } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import { Validation } from "../validation";
import {
  createPublicMapView,
  getGeoJsonFeaturesForMap,
  getPolygons,
  searchOwner,
} from "../queries/query";
import {
  createMap,
  updateMap,
  updateMapZoom,
  updateMapLngLat,
  getMapMarkers,
  createMapMembership,
  getMapPolygonsAndLines,
  getUserEmailsWithSharedMapAccess,
  deleteMapAccessByEmails,
  grantMapAccessByEmails,
} from "../queries/map";
import {
  createMarker,
  createPolygon,
  createLine,
  updateMarker,
  updatePolygon,
  updateLine,
} from "../queries/object";
import {
  Map,
  User,
  UserMap,
  PendingUserMap,
  UserMapAccess,
} from "../queries/database";
import { ItemType } from "../enums";
import { EventEmitter } from "events";
import { tryLockMap } from "../websockets/locking";

const eventEmitter = new EventEmitter();

eventEmitter.on("error", (error) => {
  console.error("Error occurred: ", error);
});

eventEmitter.emit("message", "Hello world!");

/**
 * Endpoint for user to update or create new map.
 * When "eid" field is provided as part of payload, it means map update.
 * If "eid" is null, create a new map.
 */
type SaveMapRequest = Request & {
  payload: {
    eid: number | null;
    name: string;
    data: any;
    isSnapshot: boolean;
  };
  auth: {
    credentials: {
      user_id: number;
    };
  };
};

async function saveMap(
  request: SaveMapRequest,
  h: ResponseToolkit,
  d: any
): Promise<ResponseObject> {
  let validation = new Validation();
  await validation.validateSaveMap(request.payload);

  if (validation.fail()) {
    return h.response(validation.errors).code(400);
  }

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

      await updateMap(eid, name, data);
    } else {
      const newMapId = await createMap(name, data, userId, isSnapshot);
      await tryLockMap(newMapId, userId);
    }
  } catch (err: any) {
    console.log(err.message);
    return h.response("internal server error!").code(500);
  }

  return h.response().code(200);
}

type SaveMapObjectRequest = Request & {
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
  auth: {
    credentials: {
      user_id: number;
    };
  };
};

async function saveMapMarker(
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

  const newMarker = await createMarker(
    object.name,
    object.description,
    object.center,
    uuidv4()
  );
  await createMapMembership(eid, ItemType.Marker, newMarker.idmarkers);

  return h.response();
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
  await createMapMembership(eid, ItemType.Polygon, newPolygon.idpolygons);

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
  await createMapMembership(eid, ItemType.Line, newLine.idlinestrings);

  return h.response();
}

type SaveMapZoomRequest = Request & {
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

type SaveMapLngLatRequest = Request & {
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

type EditRequest = Request & {
  payload: {
    eid: number;
    uuid: string;
    name: string;
    description: string;
  };
  auth: {
    credentials: {
      user_id: number;
    };
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

  try {
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
  } catch (err: any) {
    console.log(err.message);
    return h.response("internal server error!").code(500);
  }

  return h.response().code(200);
}

type GetMapSharedToRequest = Request & {
  params: {
    eid: number;
  };
  auth: {
    credentials: {
      user_id: number;
    };
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

  try {
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
  } catch (err: any) {
    console.log(err.message);
    return h.response("internal server error!").code(500);
  }
}

type ShareMapRequest = Request & {
  payload: {
    eid: number;
    users: { email: string; access: UserMapAccess }[];
  };
  auth: {
    credentials: {
      user_id: number;
    };
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

  try {
    const { eid, users } = request.payload;

    // email address comparison should be case insensitive
    const newUsersWithSharedMapAccess = users.map(({ email, access }) => ({
      email: email.toLowerCase(),
      access,
    }));

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

    const oldUsersWithSharedMapAccess: {
      email: string;
      access: UserMapAccess;
    }[] = (await getUserEmailsWithSharedMapAccess(eid)).map(
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
          !newUsersWithSharedMapAccess
            .map((newUser) => newUser.email)
            .includes(oldEmail)
      );

    console.log("emails to remove", emailsToRemove);
    await deleteMapAccessByEmails(eid, emailsToRemove);

    // Get new users or users that have changes to their access level
    const usersToChangeAccess = [];
    const newUsersToGrantAccess = [];

    for (const newUser of newUsersWithSharedMapAccess) {
      const oldUser = oldUsersWithSharedMapAccess.find(
        (oldUser) => oldUser.email === newUser.email
      );
      if (oldUser) {
        if (oldUser.access !== newUser.access) {
          usersToChangeAccess.push(newUser);
        }
      } else {
        newUsersToGrantAccess.push(newUser);
      }

      console.log("users to change access", usersToChangeAccess);
      await grantMapAccessByEmails(eid, usersToChangeAccess, false);

      console.log(
        "new users to grant access (and send email notification)",
        newUsersToGrantAccess
      );
      await grantMapAccessByEmails(
        eid,
        newUsersToGrantAccess,
        true,
        originDomain
      );
    }
  } catch (err: any) {
    console.log(err.message, err.stack);
    return h.response("internal server error!").code(500);
  }

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

  try {
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

    // changed from UserMapAccess.Readwrite
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
  } catch (err: any) {
    console.log(err.message);
    return h.response("internal server error!").code(500);
  }

  return h.response().code(200);
}

/**
 * Get all maps shared to user, in order of creation (oldest first).
 */
async function getUserMaps(
  request: Request,
  h: ResponseToolkit,
  d: any
): Promise<ResponseObject> {
  const userId = request.auth.credentials.user_id;

  try {
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
      const mapData = await JSON.parse(map.data);

      // get all drawings, including those in separate DB tables
      mapData.markers.markers = await getMapMarkers(map.id);
      mapData.drawings.polygons = await getMapPolygonsAndLines(map.id);

      // landDataLayers field used to be called activeLayers
      if (mapData.mapLayers.activeLayers) {
        mapData.mapLayers.landDataLayers = mapData.mapLayers.activeLayers;
        delete mapData.mapLayers.activeLayers;
      }
      // fix that some old maps may not have dataLayers field
      if (!mapData.mapLayers.myDataLayers) {
        mapData.mapLayers.myDataLayers = [];
      }

      map.data = JSON.stringify(mapData);

      const myUserMap = map.UserMaps[0];
      let sharedWith: { email: string; access: UserMapAccess }[] = [];

      // If we are the owner, get emails with whom we have shared this map
      if (myUserMap.access === UserMapAccess.Owner) {
        sharedWith = await getUserEmailsWithSharedMapAccess(map.id);
      }

      allMapsData.push({
        map: {
          eid: map.id,
          name: map.name,
          data: map.data,
          createdDate: map.created_date,
          lastModified: map.last_modified,
          sharedWith: sharedWith,
          isSnapshot: map.is_snapshot,
        },
        accessGrantedDate: myUserMap.created_date,
        access: myUserMap.access,
        viewed: myUserMap.viewed == 1,
      });
    }

    return h.response(allMapsData).code(200);
  } catch (err: any) {
    console.error("error getting user maps:", err.message);
    return h.response("internal server error!").code(500);
  }
}

/**
 * Get the geojson polygons of land ownership within a given bounding box area
 *
 * @param request
 * @param h
 * @param d
 * @returns
 */
async function getLandOwnershipPolygons(
  request: Request,
  h: ResponseToolkit,
  d: any
): Promise<ResponseObject> {
  let validation = new Validation();
  await validation.validateLandOwnershipPolygonRequest(request.query);

  if (validation.fail()) {
    return h.response(validation.errors).code(400);
  }

  try {
    const payload: any = request.query;

    const polygons = await getPolygons(
      payload.sw_lng,
      payload.sw_lat,
      payload.ne_lng,
      payload.ne_lat
    );

    return h.response(polygons).code(200);
  } catch (err: any) {
    console.log(err.message);
    return h.response("internal server error!").code(500);
  }
}

async function searchOwnership(
  request: Request,
  h: ResponseToolkit
): Promise<ResponseObject> {
  const { proprietorName } = request.query;

  const polygonsAndOwnerships = await searchOwner(proprietorName);

  return h.response(polygonsAndOwnerships).code(200);
}

type PublicMapRequest = Request & {
  payload: {
    mapId: number;
  };
  auth: {
    credentials: {
      user_id: number;
    };
  };
};

type FileResponseToolkit = ResponseToolkit & {
  file: Function;
};

async function downloadMap(
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

  return response;
}

async function setMapPublic(
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

  // changed from UserMapAccess.Readwrite
  if (userMapView?.access === UserMapAccess.Owner) {
    const publicMapAddress = await createPublicMapView(mapId);

    return h.response(publicMapAddress);
  } else {
    return h
      .response(
        "You don't have write access to this map, so can't make it public."
      )
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
  // Make a map accessible to the public
  { method: "POST", path: "/api/user/map/share/public", handler: setMapPublic },
  // Returns a map converted to shapefile format
  {
    method: "GET",
    path: "/api/user/map/download/{mapId}",
    handler: downloadMap,
  },
  // Returns a list of all maps that the user has access to
  { method: "GET", path: "/api/user/maps", handler: getUserMaps },
  // Get the geojson polygons of land ownership within a given bounding box area
  { method: "GET", path: "/api/ownership", handler: getLandOwnershipPolygons },
  // search the public ownership information
  { method: "GET", path: "/api/search", handler: searchOwnership },
  // Get a public map
  {
    method: "GET",
    path: "/api/public/map/{mapId}",
    handler: getPublicMap,
    options: { auth: false },
  },
];
