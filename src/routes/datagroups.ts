import { Request, ResponseToolkit, ResponseObject, ServerRoute } from "@hapi/hapi";
import {
  createMarker,
  createPolygon,
  createLine,
  updateMarker,
  updatePolygon,
  updateLine,
} from "../queries/object";
import {
  hasAccessToDataGroup,
  findAllDataGroupContentForUser,
} from "../queries/query";
import { v4 as uuidv4 } from "uuid";

type DataGroupRequest = Request & {
  auth: {
    credentials: {
      user_id: number;
    };
  };
};

async function getUserDataGroups(
  request: DataGroupRequest,
  h: ResponseToolkit
): Promise<ResponseObject> {
  const dataGroups = await findAllDataGroupContentForUser(
    request.auth.credentials.user_id
  );

  return h.response(dataGroups);
}

type SaveDataGroupObjectRequest = Request & {
  payload: {
    object: {
      name: string;
      description: string;
      vertices: number[][];
      center: number[];
      length: number;
      area: number;
    };
    dataGroupId: number;
  };
  auth: {
    credentials: {
      user_id: number;
    };
  };
};

async function saveDataGroupMarker(
  request: SaveDataGroupObjectRequest,
  h: ResponseToolkit,
  d: any
): Promise<ResponseObject> {
  const { object, dataGroupId } = request.payload;

  const hasAccess = await hasAccessToDataGroup(
    request.auth.credentials.user_id,
    dataGroupId
  );
  if (!hasAccess) {
    return h.response("Unauthorised").code(403);
  }

  await createMarker(
    object.name,
    object.description,
    object.center,
    uuidv4(),
    dataGroupId
  );

  return h.response();
}

async function saveDataGroupPolygon(
  request: SaveDataGroupObjectRequest,
  h: ResponseToolkit,
  d: any
): Promise<ResponseObject> {
  const { object, dataGroupId } = request.payload;

  const hasAccess = await hasAccessToDataGroup(
    request.auth.credentials.user_id,
    dataGroupId
  );
  if (!hasAccess) {
    return h.response("Unauthorised").code(403);
  }

  await createPolygon(
    object.name,
    object.description,
    object.vertices,
    object.center,
    object.length,
    object.area,
    uuidv4(),
    dataGroupId
  );

  return h.response();
}

async function saveDataGroupLine(
  request: SaveDataGroupObjectRequest,
  h: ResponseToolkit,
  d: any
): Promise<ResponseObject> {
  const { object, dataGroupId } = request.payload;

  const hasAccess = await hasAccessToDataGroup(
    request.auth.credentials.user_id,
    dataGroupId
  );
  if (!hasAccess) {
    return h.response("Unauthorised").code(403);
  }

  await createLine(
    object.name,
    object.description,
    object.vertices,
    object.length,
    uuidv4(),
    dataGroupId
  );

  return h.response();
}

/**
 * Edit the name/description of a datagroup object.
 */
type EditDataGroupObjectRequest = Request & {
  payload: {
    dataGroupId: number;
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
 * TODO: enable locking or instant refresh in the front-end so that conflicts don't arise when
 * datagroup objects are edited.
 */
async function editDataGroupMarker(
  request: EditDataGroupObjectRequest,
  h: ResponseToolkit
): Promise<ResponseObject> {
  const { uuid, name, description, dataGroupId } = request.payload;

  const hasAccess = await hasAccessToDataGroup(
    request.auth.credentials.user_id,
    dataGroupId
  );
  if (!hasAccess) {
    return h.response("Unauthorised").code(403);
  }

  await updateMarker(uuid, name, description);

  return h.response();
}

async function editDataGroupPolygon(
  request: EditDataGroupObjectRequest,
  h: ResponseToolkit
): Promise<ResponseObject> {
  const { uuid, name, description, dataGroupId } = request.payload;

  const hasAccess = await hasAccessToDataGroup(
    request.auth.credentials.user_id,
    dataGroupId
  );
  if (!hasAccess) {
    return h.response("Unauthorised").code(403);
  }

  await updatePolygon(uuid, name, description);

  return h.response();
}

async function editDataGroupLine(
  request: EditDataGroupObjectRequest,
  h: ResponseToolkit
): Promise<ResponseObject> {
  const { uuid, name, description, dataGroupId } = request.payload;

  const hasAccess = await hasAccessToDataGroup(
    request.auth.credentials.user_id,
    dataGroupId
  );
  if (!hasAccess) {
    return h.response("Unauthorised").code(403);
  }

  await updateLine(uuid, name, description);

  return h.response();
}

export const dataGroupRoutes: ServerRoute[] = [
  // Get data groups that the user can access and their data
  { method: "GET", path: "/user/datagroups", handler: getUserDataGroups },
  // Save an object to a data group
  {
    method: "POST",
    path: "/user/datagroup/save/marker",
    handler: saveDataGroupMarker,
  },
  {
    method: "POST",
    path: "/user/datagroup/save/polygon",
    handler: saveDataGroupPolygon,
  },
  {
    method: "POST",
    path: "/user/datagroup/save/line",
    handler: saveDataGroupLine,
  },
  // Edit a datagroup object
  {
    method: "POST",
    path: "/user/datagroup/edit/marker",
    handler: editDataGroupMarker,
  },
  {
    method: "POST",
    path: "/user/datagroup/edit/polygon",
    handler: editDataGroupPolygon,
  },
  {
    method: "POST",
    path: "/user/datagroup/edit/line",
    handler: editDataGroupLine,
  },
];
