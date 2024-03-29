import { Request, ResponseToolkit, ResponseObject, ServerRoute } from "@hapi/hapi";
import { Op } from "sequelize";
import { v4 as uuidv4 } from 'uuid';
import { Validation } from '../validation';
import { createPublicMapView, getGeoJsonFeaturesForMap, getPolygons, searchOwner } from "../queries/query";
import { createMap, updateMap, updateMapZoom, updateMapLngLat, getMapMarkers, createMapMembership, getMapPolygonsAndLines } from '../queries/map';
import { createMarker, createPolygon, createLine, updateMarker, updatePolygon, updateLine } from '../queries/object';
import { Map, User, UserMap, PendingUserMap, UserMapAccess, Marker, Polygon, Line } from "../queries/database";
import { ItemType } from "../enums";
import * as mailer from '../queries/mails';

/**
 * Endpoint for user to update or create new map.
 * When "eid" field is provided as part of payload, it means map update.
 * Without "eid" means create new map.
 * 
 * @param request 
 * @param h 
 * @param d 
 * @returns 
 */

type SaveMapRequest = Request & {
    payload: {
        eid: number;
        name: string;
        data: any;
        isSnapshot: boolean;
    },
    auth: {
        credentials: {
            user_id: number;
        }
    }
};

async function saveMap(request: SaveMapRequest, h: ResponseToolkit, d: any): Promise<ResponseObject> {

    let validation = new Validation();
    await validation.validateSaveMap(request.payload);

    if (validation.fail()) {
        return h.response(validation.errors).code(400);
    }

    try {

        const { eid, name, data, isSnapshot } = request.payload;

        // eid provided means update map
        const isUpdate = eid !== null;

        if (isUpdate) {
            // check that the map exists and isn't a snapshot
            const existsAndEditable = await Map.findOne({
                where: {
                    id: eid,
                    is_snapshot: { [Op.or]: [false, null] }
                }
            });

            if (existsAndEditable === null) {
                return h.response("Map not found").code(404);
            }

            // check that user has permission to update the map
            const hasAccess = await UserMap.findOne({
                where: {
                    map_id: eid,
                    access: UserMapAccess.Readwrite,
                    user_id: request.auth.credentials.user_id
                }
            });

            if (hasAccess === null) {
                return h.response("Unauthorised").code(403);
            }

            await updateMap(eid, name, data);
        } else {
            await createMap(name, data, request.auth.credentials.user_id, isSnapshot);
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
        },
        eid: number;
    }
};

async function saveMapMarker(request: SaveMapObjectRequest, h: ResponseToolkit, d: any): Promise<ResponseObject> {
    const { object, eid } = request.payload;

    // check that user has permission to update this map
    const hasAccess = await UserMap.findOne({
        where: {
            map_id: eid,
            access: UserMapAccess.Readwrite,
            user_id: request.auth.credentials.user_id
        }
    });
    if (hasAccess === null) {
        return h.response("Unauthorised").code(403);
    }

    const newMarker = await createMarker(object.name, object.description, object.center, uuidv4());
    await createMapMembership(eid, ItemType.Marker, newMarker.idmarkers);

    return h.response();
}

async function saveMapPolygon(request: SaveMapObjectRequest, h: ResponseToolkit, d: any): Promise<ResponseObject> {
    const { object, eid } = request.payload;

    // check that user has permission to update this map
    const hasAccess = await UserMap.findOne({
        where: {
            map_id: eid,
            access: UserMapAccess.Readwrite,
            user_id: request.auth.credentials.user_id
        }
    });
    if (hasAccess === null) {
        return h.response("Unauthorised").code(403);
    }

    const newPolygon = await createPolygon(
        object.name, object.description, object.vertices, object.center, object.length, object.area, uuidv4()
    );
    await createMapMembership(eid, ItemType.Polygon, newPolygon.idpolygons);

    return h.response();
}

async function saveMapLine(request: SaveMapObjectRequest, h: ResponseToolkit, d: any): Promise<ResponseObject> {
    const { object, eid } = request.payload;

    // check that user has permission to update this map
    const hasAccess = await UserMap.findOne({
        where: {
            map_id: eid,
            access: UserMapAccess.Readwrite,
            user_id: request.auth.credentials.user_id
        }
    });
    if (hasAccess === null) {
        return h.response("Unauthorised").code(403);
    }

    const newLine = await createLine(
        object.name, object.description, object.vertices, object.length, uuidv4()
    );
    await createMapMembership(eid, ItemType.Line, newLine.idlinestrings);

    return h.response();
}

type SaveMapZoomRequest = Request & {
    payload: {
        eid: number;
        zoom: number[];
    }
};

async function saveMapZoom(request: SaveMapZoomRequest, h: ResponseToolkit, d: any): Promise<ResponseObject> {
    const { eid, zoom } = request.payload;

    // check that user has permission to update this map
    const hasAccess = await UserMap.findOne({
        where: {
            map_id: eid,
            access: UserMapAccess.Readwrite,
            user_id: request.auth.credentials.user_id
        }
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
    }
};

async function saveMapLngLat(request: SaveMapLngLatRequest, h: ResponseToolkit, d: any): Promise<ResponseObject> {
    const { eid, lngLat } = request.payload;

    // check that user has permission to update this map
    const hasAccess = await UserMap.findOne({
        where: {
            map_id: eid,
            access: UserMapAccess.Readwrite,
            user_id: request.auth.credentials.user_id
        }
    });
    if (hasAccess === null) {
        return h.response("Unauthorised").code(403);
    }

    await updateMapLngLat(eid, lngLat);

    return h.response();
}

type EditRequest = Request & {
    payload: {
        uuid: string;
        name: string;
        description: string;
    }
};

async function editMarker(request: EditRequest, h: ResponseToolkit): Promise<ResponseObject> {
    const { uuid, name, description } = request.payload;

    await updateMarker(uuid, name, description);

    return h.response();
}

async function editPolygon(request: EditRequest, h: ResponseToolkit): Promise<ResponseObject> {
    const { uuid, name, description } = request.payload;

    await updatePolygon(uuid, name, description);

    return h.response();
}

async function editLine(request: EditRequest, h: ResponseToolkit): Promise<ResponseObject> {
    const { uuid, name, description } = request.payload;

    await updateLine(uuid, name, description);

    return h.response();
}

/**
 * Set a map as viewed.
 * 
 * @param request 
 * @param h 
 * @param d 
 * @returns 
 */
async function setMapAsViewed(request: Request, h: ResponseToolkit, d: any): Promise<ResponseObject> {

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
                }
            }
        );

    } catch (err: any) {
        console.log(err.message);
        return h.response("internal server error!").code(500);
    }

    return h.response().code(200);
}


/**
 * A method to share access of a map to a list of email addresses
 * Email address may or may not be a registered land-ex user and need to be handled accordingly.
 * Email address given may already be recorded in the database (do not resend email invitation).   
 * 
 * @param request 
 * @param h 
 * @param d 
 * @returns 
 */
async function mapSharing(request: Request, h: ResponseToolkit, d: any): Promise<ResponseObject> {
    const originDomain = `https://${request.info.host}`;

    const validation = new Validation();
    await validation.validateShareMap(request.payload);

    if (validation.fail()) {
        return h.response(validation.errors).code(400);
    }

    try {

        const payload: any = request.payload;

        let userMap = await UserMap.findOne(
            {
                where: {
                    user_id: request.auth.credentials.user_id,
                    map_id: payload.eid
                },
                include: [
                    Map,
                    User
                ]
            }
        );

        if (!userMap || userMap.Map.deleted) {
            return h.response("Map not found").code(404);
        }

        if (userMap.access !== UserMapAccess.Readwrite) {
            return h.response("Unauthorised!").code(403);
        }

        // Since map sharing is stored on both UserMap (for registered user)
        // and PendingUserMap (for non-registered user), the sync need to be
        // performed on both table.

        //Get all email address from user_map that has access to map excluding current user
        const userEmailWithMapAccessViaUserMap = (await UserMap.findAll(
            {
                where: {
                    map_id: payload.eid,
                    user_id: {
                        [Op.ne]: request.auth.credentials.user_id,
                    }
                },
                include: [
                    User
                ]
            }
        )).map(function (element: any) {
            return element.User.username.toLowerCase();
        });

        //Get all email address from pending_user_map that has access to map
        const userEmailWithMapAccessViaPendingUserMap = (await PendingUserMap.findAll(
            {
                where: {
                    map_id: payload.eid
                }
            }
        )).map(function (element: any) {
            return element.email_address.toLowerCase();
        });

        // email address comparison should be case insensitive
        const emailAddresses = payload.emailAddresses.map(function (e: any) { return e.toLowerCase() });

        // Get emails that need to be removed from the DB (access has been revoked)
        let emailsToRemoveFromUserMap = userEmailWithMapAccessViaUserMap.filter(function (e: any) { return !emailAddresses.includes(e) });
        let emailsToRemoveFromPendingUserMap = userEmailWithMapAccessViaPendingUserMap.filter(function (e: any) { return !emailAddresses.includes(e) });

        console.log(emailsToRemoveFromUserMap);
        //return h.response().code(200);

        // Remove emails from user_map
        await deleteMapAccessByEmails(payload.eid, [...emailsToRemoveFromUserMap, ...emailsToRemoveFromPendingUserMap]);


        // Now get emails that are newly given the map access.
        const newEmailsToGrantAccess = emailAddresses
            .filter(function (x: any) {
                return !userEmailWithMapAccessViaUserMap.includes(x)
            })
            .filter(function (x: any) {
                return !userEmailWithMapAccessViaPendingUserMap.includes(x)
            });

        // Now we split those emails into array of existing users and new users

        // This is array of existing users that we want to grant access to map
        const userListToAddToUserMap = (await User.findAll(
            {
                where: {
                    username: {
                        [Op.in]: newEmailsToGrantAccess
                    }
                }
            }
        ));

        const existingUserEmails = userListToAddToUserMap.map(function (element: any) {
            return element.username.toLowerCase();
        });

        // This is array of email address string to be added to pending user map
        const newEmailsToAddToPendingUserMap = newEmailsToGrantAccess.filter(function (x: any) {
            return !existingUserEmails.includes(x)
        });

        // add to user map
        await UserMap.bulkCreate(
            userListToAddToUserMap.map(function (user: any) {
                return {
                    map_id: payload.eid,
                    user_id: user.id,
                    access: UserMapAccess.Readonly,
                };
            })
        );

        // add to pending user map
        await PendingUserMap.bulkCreate(
            newEmailsToAddToPendingUserMap.map(function (email: any) {
                return {
                    map_id: payload.eid,
                    email_address: email,
                    access: UserMapAccess.Readonly,
                };
            })
        );

        // send emails

        // Get sharer information for email
        const sharer_firstname: string = UserMap.User.first_name
        const sharer_fullname: string = sharer_firstname + " " + UserMap.User.last_name;
        const map_name: string = UserMap.Map.name;

        userListToAddToUserMap.forEach(function (user: any) {
            mailer.shareMapRegistered(user.username, user.first_name, sharer_fullname, sharer_firstname, map_name, originDomain);
        });

        newEmailsToAddToPendingUserMap.forEach(function (email: any) {
            mailer.shareMapUnregistered(email, sharer_fullname, sharer_firstname, map_name, originDomain);
        });

    } catch (err: any) {
        console.log(err.message);
        return h.response("internal server error!").code(500);
    }

    return h.response().code(200);
}

/**
 * Takes an array of email addresses and delete their access to a given map id.
 * This method will check and delete both access via user_map and pending_user_map
 *   
 * @param map_id 
 * @param emails 
 */
async function deleteMapAccessByEmails(map_id: number, emails: string[]) {

    // delete from user map
    let users = await User.findAll({
        where: {
            username: {
                [Op.in]: emails
            }
        }
    })

    await UserMap.destroy({
        where: {
            map_id: map_id,
            user_id: {
                [Op.in]: users.map(function (user: any) {
                    return user.id;
                })
            }
        }
    });

    // delete from pending user map
    await PendingUserMap.destroy({
        where: {
            email_address: {
                [Op.in]: emails
            }
        }
    });
}

/**
 * Soft delete a map owned by user.
 * 
 * @param request 
 * @param h 
 * @param d 
 * @returns 
 */
async function deleteMap(request: Request, h: ResponseToolkit, d: any): Promise<ResponseObject> {

    let validation = new Validation();
    await validation.validateEid(request.payload);

    if (validation.fail()) {
        return h.response(validation.errors).code(400);
    }

    try {

        let payload: any = request.payload;

        let userMap = await UserMap.findOne(
            {
                where: {
                    user_id: request.auth.credentials.user_id,
                    map_id: payload.eid
                },
                include: [
                    Map,
                    User
                ]
            }
        );


        if (!userMap || userMap.Map.deleted) {
            return h.response("Map not found").code(404);
        }

        if (userMap.access !== UserMapAccess.Readwrite) {
            return h.response("Unauthorised!").code(403);
        }


        await Map.update(
            {
                deleted: 1,
            },
            {
                where: {
                    id: payload.eid
                }
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
async function getUserMaps(request: Request, h: ResponseToolkit, d: any): Promise<ResponseObject> {
    const userId = request.auth.credentials.user_id;

    try {
        const allMaps = await Map.findAll(
            {
                where: {
                    '$UserMaps.user_id$': userId,
                    deleted: 0,
                },
                include: [
                    {
                        model: UserMap,
                        as: 'UserMaps'
                    },
                    PendingUserMap
                ],
                order: [
                    ['id', 'ASC'],
                    [UserMap, 'access', 'ASC']
                ]
            });

        const allMapsData = []

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

            // Get users with whom we have shared this map
            const sharedWith: any[] = [];

            const otherUserMaps = await UserMap.findAll({
                where: {
                    map_id: map.id,
                    user_id: { [Op.not]: userId }
                }
            });

            for (const userMap of otherUserMaps) {
                const { username } = await User.findOne({
                    where: { id: userMap.user_id }
                })

                sharedWith.push({
                    emailAddress: username,
                    viewed: userMap.viewed === 1
                });
            }

            const pendingUserMaps = await PendingUserMap.findAll({
                where: {
                    map_id: map.id
                }
            })

            pendingUserMaps.forEach((pendingUserMap: any) => {
                sharedWith.push({
                    emailAddress: pendingUserMap.email_address,
                    viewed: false
                });
            });

            allMapsData.push({
                map: {
                    eid: map.id,
                    name: map.name,
                    data: map.data,
                    createdDate: map.created_date,
                    lastModified: map.last_modified,
                    sharedWith: sharedWith,
                    isSnapshot: map.is_snapshot
                },
                accessGrantedDate: myUserMap.created_date,
                access: myUserMap.access === UserMapAccess.Readwrite ? "WRITE" : "READ",
                viewed: myUserMap.viewed === 1
            })
        };

        return h.response(allMapsData).code(200);

    } catch (err: any) {
        console.log(err.message);
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
async function getLandOwnershipPolygons(request: Request, h: ResponseToolkit, d: any): Promise<ResponseObject> {

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
            payload.ne_lat,
        );

        return h.response(polygons).code(200);

    } catch (err: any) {
        console.log(err.message);
        if (!err.response) {
            // network error
            return h.response("Could not retrieve polygons").code(404);
        }
        return h.response("internal server error!").code(500);
    }
}

async function searchOwnership(request: Request, h: ResponseToolkit): Promise<ResponseObject> {
    const { proprietorName } = request.query;

    const polygonsAndOwnerships = await searchOwner(proprietorName);

    return h.response(polygonsAndOwnerships).code(200);
}

type PublicMapRequest = Request & {
    payload: {
        mapId: number
    },
    auth: {
        credentials: {
            user_id: number
        }
    }
}

type FileResponseToolkit = ResponseToolkit & {
    file: Function;
}

async function downloadMap(request: PublicMapRequest, h: FileResponseToolkit): Promise<ResponseObject> {
    const { mapId } = request.params;
    const { user_id } = request.auth.credentials;

    const hasAccess = await UserMap.findOne({
        where: {
            user_id,
            map_id: mapId
        }
    });
    if (!hasAccess) {
        return h.response("Unauthorised!").code(403);
    }

    const features = await getGeoJsonFeaturesForMap(mapId);

    const shapeFileDirectory = './data/shapefiles';
    const shapeFileLocation = `${shapeFileDirectory}/Map-${mapId}-${Date.now()}.zip`;

    const fs = require('fs');

    fs.mkdir(shapeFileDirectory, { recursive: true }, (error: any) => {
        if (error) throw error;
    });

    const { convert } = require('geojson2shp');
    // geojson2shp writing to file path isn't working so create our own write stream
    const outStream = fs.createWriteStream(shapeFileLocation);
    const convertOptions = {
        layer: 'land-explorer-layer',
        targetCrs: 2154,
        encoding: 'latin1'
    };
    // create a new shapefile in the shape file location
    await convert(features, outStream, convertOptions);

    const response = h.file(shapeFileLocation, {
        mode: 'attachment'
    });

    const deleteFile = () => {
        fs.unlink(shapeFileLocation, (error: any) => {
            if (error) throw error;
        });
    }

    setTimeout(deleteFile, 5000);

    return response;
}

async function setMapPublic(request: PublicMapRequest, h: ResponseToolkit): Promise<ResponseObject> {
    const { mapId } = request.payload;
    const { user_id } = request.auth.credentials;

    const userMapView = await UserMap.findOne({
        where: {
            map_id: mapId,
            user_id: user_id
        }
    });

    if (userMapView?.access === UserMapAccess.Readwrite) {
        const publicMapAddress = await createPublicMapView(mapId);

        return h.response(publicMapAddress);
    } else {
        return h.response("You don't have write access to this map, so can't make it public.").code(403);
    }
}

async function getPublicMap(request: Request, h: ResponseToolkit): Promise<ResponseObject> {
    const { mapId } = request.params;

    const publicMapView = await UserMap.findOne({
        where: {
            map_id: mapId,
            user_id: -1 // public user ID
        }
    })

    if (publicMapView) {
        const geoJsonData = await getGeoJsonFeaturesForMap(mapId);
        return h.response(geoJsonData);
    }
    else {
        return h.response("No public map at this address.").code(404);
    }
}

export const mapRoutes: ServerRoute[] = [
    // Create or update a map
    { method: "POST", path: "/api/user/map/save", handler: saveMap },
    // Save an object to a map
    { method: "POST", path: "/api/user/map/save/marker", handler: saveMapMarker },
    { method: "POST", path: "/api/user/map/save/polygon", handler: saveMapPolygon },
    { method: "POST", path: "/api/user/map/save/line", handler: saveMapLine },
    // Save the zoom level of a map
    { method: "POST", path: "/api/user/map/save/zoom", handler: saveMapZoom },
    // Save the longitude and latitude of a map (i.e. when the frame is moved)
    { method: "POST", path: "/api/user/map/save/lngLat", handler: saveMapLngLat },
    // Edit an object
    { method: "POST", path: "/api/user/edit/marker", handler: editMarker },
    { method: "POST", path: "/api/user/edit/polygon", handler: editPolygon },
    { method: "POST", path: "/api/user/edit/line", handler: editLine },
    // Record that the user has viewed a map
    { method: "POST", path: "/api/user/map/view", handler: setMapAsViewed },
    // Share access of a map to a list of email addresses
    { method: "POST", path: "/api/user/map/share/sync", handler: mapSharing },
    // Delete a map
    { method: "POST", path: "/api/user/map/delete", handler: deleteMap },
    // Make a map accessible to the public
    { method: "POST", path: "/api/user/map/share/public", handler: setMapPublic },
    // Returns a map converted to shapefile format
    { method: "GET", path: "/api/user/map/download/{mapId}", handler: downloadMap },
    // Returns a list of all maps that the user has access to
    { method: "GET", path: "/api/user/maps", handler: getUserMaps },
    // Get the geojson polygons of land ownership within a given bounding box area
    { method: "GET", path: "/api/ownership", handler: getLandOwnershipPolygons },
    // search the public ownership information
    { method: "GET", path: "/api/search", handler: searchOwnership },
    // Get a public map
    { method: "GET", path: "/api/public/map/{mapId}", handler: getPublicMap, options: { auth: false } },
];
