import { Request, ResponseToolkit, ResponseObject, ServerRoute } from "@hapi/hapi";
import { createMarker, createPolygon, createLine } from '../queries/object';
import { hasAccessToDataGroup, findAllDataGroupContentForUser } from "../queries/query";
import { v4 as uuidv4 } from 'uuid';

type DataGroupRequest = Request & {
    auth: {
        artifacts: {
            user_id: number;
        }
    }
};

async function getUserDataGroups(request: DataGroupRequest, h: ResponseToolkit): Promise<ResponseObject> {
    const dataGroups = await findAllDataGroupContentForUser(request.auth.artifacts.user_id);

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
        },
        dataGroupId: number;
    },
    auth: {
        artifacts: {
            user_id: number;
        }
    }
};

async function saveDataGroupMarker(request: SaveDataGroupObjectRequest, h: ResponseToolkit, d: any): Promise<ResponseObject> {
    const { object, dataGroupId } = request.payload;

    const hasAccess = await hasAccessToDataGroup(request.auth.artifacts.user_id, dataGroupId);
    if (!hasAccess) {
        return h.response("Unauthorised").code(403);
    }

    await createMarker(object.name, object.description, object.center, uuidv4(), dataGroupId);

    return h.response();
}

async function saveDataGroupPolygon(request: SaveDataGroupObjectRequest, h: ResponseToolkit, d: any): Promise<ResponseObject> {
    const { object, dataGroupId } = request.payload;

    const hasAccess = await hasAccessToDataGroup(request.auth.artifacts.user_id, dataGroupId);
    if (!hasAccess) {
        return h.response("Unauthorised").code(403);
    }

    await createPolygon(object.name, object.description, object.vertices, object.center, object.length, object.area, uuidv4(), dataGroupId);

    return h.response();
}

async function saveDataGroupLine(request: SaveDataGroupObjectRequest, h: ResponseToolkit, d: any): Promise<ResponseObject> {
    const { object, dataGroupId } = request.payload;

    const hasAccess = await hasAccessToDataGroup(request.auth.artifacts.user_id, dataGroupId);
    if (!hasAccess) {
        return h.response("Unauthorised").code(403);
    }

    await createLine(object.name, object.description, object.vertices, object.length, uuidv4(), dataGroupId);

    return h.response();
}

export const dataGroupRoutes: ServerRoute[] = [
    { method: "GET", path: "/api/user/datagroups", handler: getUserDataGroups },
    { method: "POST", path: "/api/user/datagroup/save/marker", handler: saveDataGroupMarker },
    { method: "POST", path: "/api/user/datagroup/save/polygon", handler: saveDataGroupPolygon },
    { method: "POST", path: "/api/user/datagroup/save/line", handler: saveDataGroupLine },
];
