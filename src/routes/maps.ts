import { Request, ResponseToolkit, ResponseObject, ServerRoute } from "@hapi/hapi";
import { Validation } from '../validation';
import { findPublicMap, createPublicMapView } from "../queries/query";
import { createMap, updateMap, getMapMarkers } from '../queries/map';
import { UserMapAccess } from "../queries/database";

const Model = require('../queries/database');
const { Op } = require("sequelize");
const mailer = require('../queries/mails');
const query = require('../queries/query');

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
    },
    auth: {
        artifacts: {
            user_id: number
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

        const { eid, name, data } = request.payload;

        // eid provided means update map
        const mapExists = eid != null;

        if (mapExists) {
            // check that user has permission to update the map
            const hasAccess = await Model.UserMap.findOne({
                where: {
                    map_id: eid,
                    access: UserMapAccess.Readwrite,
                    user_id: request.auth.artifacts.user_id
                }
            });

            if (hasAccess == null) {
                return h.response("Unauthorised").code(403);
            }

            await updateMap(eid, name, data);
        } else {
            await createMap(name, data, request.auth.artifacts.user_id);
        }

    } catch (err: any) {
        console.log(err.message);
        return h.response("internal server error!").code(500);
    }

    return h.response().code(200);
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

        await Model.UserMap.update(
            {
                viewed: 1,
                data: payload.data,
            },
            {
                where: {
                    user_id: request.auth.artifacts.user_id,
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
    const originDomain = request.headers.referer;

    const validation = new Validation();
    await validation.validateShareMap(request.payload);

    if (validation.fail()) {
        return h.response(validation.errors).code(400);
    }

    try {

        const payload: any = request.payload;

        let UserMap = await Model.UserMap.findOne(
            {
                where: {
                    user_id: request.auth.artifacts.user_id,
                    map_id: payload.eid
                },
                include: [
                    Model.Map,
                    Model.User
                ]
            }
        );

        if (!UserMap || UserMap.Map.deleted) {
            return h.response("Map not found").code(404);
        }

        if (UserMap.access !== 2) {
            return h.response("Unauthorised!").code(403);
        }

        // Since map sharing is stored on both UserMap (for registered user)
        // and PendingUserMap (for non-registered user), the sync need to be
        // performed on both table.

        //Get all email address from user_map that has access to map excluding current user
        const UserEmailWithMapAccessViaUserMap = (await Model.UserMap.findAll(
            {
                where: {
                    map_id: payload.eid,
                    user_id: {
                        [Op.ne]: request.auth.artifacts.user_id,
                    }
                },
                include: [
                    Model.User
                ]
            }
        )).map(function (element: any) {
            return element.User.username.toLowerCase();
        });

        //Get all email address from pending_user_map that has access to map
        const UserEmailWithMapAccessViaPendingUserMap = (await Model.PendingUserMap.findAll(
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
        let emailsToRemoveFromUserMap = UserEmailWithMapAccessViaUserMap.filter(function (e: any) { return !emailAddresses.includes(e) });
        let emailsToRemoveFromPendingUserMap = UserEmailWithMapAccessViaPendingUserMap.filter(function (e: any) { return !emailAddresses.includes(e) });

        console.log(emailsToRemoveFromUserMap);
        //return h.response().code(200);

        // Remove emails from user_map
        await deleteMapAccessByEmails(payload.eid, emailsToRemoveFromUserMap);
        await deleteMapAccessByEmails(payload.eid, emailsToRemoveFromPendingUserMap);


        // Now get emails that are newly given the map access.
        const newEmailsToGrantAccess = emailAddresses
            .filter(function (x: any) {
                return !UserEmailWithMapAccessViaUserMap.includes(x)
            })
            .filter(function (x: any) {
                return !UserEmailWithMapAccessViaPendingUserMap.includes(x)
            });

        // Now we split those emails into array of existing users and new users

        // This is array of existing users that we want to grant access to map
        const UserListToAddToUserMap = (await Model.User.findAll(
            {
                where: {
                    username: {
                        [Op.in]: newEmailsToGrantAccess
                    }
                }
            }
        ));

        const existingUserEmails = UserListToAddToUserMap.map(function (element: any) {
            return element.username.toLowerCase();
        });

        // This is array of email address string to be added to pending user map
        const NewEmailsToAddToPendingUserMap = newEmailsToGrantAccess.filter(function (x: any) {
            return !existingUserEmails.includes(x)
        });

        // add to user map
        await Model.UserMap.bulkCreate(
            UserListToAddToUserMap.map(function (user: any) {
                return {
                    map_id: payload.eid,
                    user_id: user.id,
                    access: UserMapAccess.Readonly,
                };
            })
        );

        // add to pending user map
        await Model.PendingUserMap.bulkCreate(
            NewEmailsToAddToPendingUserMap.map(function (email: any) {
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

        UserListToAddToUserMap.forEach(function (user: any) {
            mailer.shareMapRegistered(user.username, user.first_name, sharer_fullname, sharer_firstname, map_name, originDomain);
        });

        NewEmailsToAddToPendingUserMap.forEach(function (email: any) {
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
    let users = await Model.User.findAll({
        where: {
            username: {
                [Op.in]: emails
            }
        }
    })

    await Model.UserMap.destroy({
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
    await Model.PendingUserMap.destroy({
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

        let UserMap = await Model.UserMap.findOne(
            {
                where: {
                    user_id: request.auth.artifacts.user_id,
                    map_id: payload.eid
                },
                include: [
                    Model.Map,
                    Model.User
                ]
            }
        );


        if (!UserMap || UserMap.Map.deleted) {
            return h.response("Map not found").code(404);
        }

        if (UserMap.access !== 2) {
            return h.response("Unauthorised!").code(403);
        }


        await Model.Map.update(
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
 * Get all map shared to user
 * 
 * @param request 
 * @param h 
 * @param d 
 * @returns 
 */
async function getUserMaps(request: Request, h: ResponseToolkit, d: any): Promise<ResponseObject> {
    const userId = request.auth.artifacts.user_id;

    try {
        const Maps = await Model.Map.findAll(
            {
                where: {
                    '$UserMaps.user_id$': userId,
                    deleted: 0,
                },
                include: [
                    {
                        model: Model.UserMap,
                        as: 'UserMaps'
                    },
                    Model.PendingUserMap
                ],
                order: [
                    ['id', 'ASC'],
                    [Model.UserMap, 'access', 'ASC']
                ]
            });

        const MapsWithShared = []

        for (const Map of Maps) {
            const mapData = await JSON.parse(Map.data);

            if (mapData.drawingsInDB) {
                mapData.markers.markers = await getMapMarkers(Map.id);
                Map.data = JSON.stringify(mapData);
            }

            const userMap = Map.UserMaps[0];
            const sharedWith: any[] = [];

            const UserMaps = await Model.UserMap.findAll({
                where: {
                    map_id: Map.id,
                    user_id: { [Op.not]: userId }
                }
            });

            for (const UserMap of UserMaps) {
                const { username } = await Model.User.findOne({
                    where: { id: UserMap.user_id }
                })

                sharedWith.push({
                    emailAddress: username,
                    viewed: UserMap.viewed == 1
                });
            }

            const PendingUserMaps = await Model.PendingUserMap.findAll({
                where: {
                    map_id: Map.id
                }
            })

            PendingUserMaps.forEach((PendingUserMap: any) => {
                sharedWith.push({
                    emailAddress: PendingUserMap.email_address,
                    viewed: PendingUserMap.viewed == 1
                });
            });

            MapsWithShared.push({
                map: {
                    eid: Map.id,
                    name: Map.name,
                    data: Map.data,
                    createdDate: Map.created_date,
                    lastModified: Map.last_modified,
                    sharedWith: sharedWith,
                },
                createdDate: userMap.created_date,
                access: userMap.access == UserMapAccess.Readwrite ? "WRITE" : "READ",
                viewed: userMap.viewed == 1
            })
        };

        return h.response(MapsWithShared).code(200);

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
async function getLandOwnershipPolygon(request: Request, h: ResponseToolkit, d: any): Promise<ResponseObject> {

    let validation = new Validation();
    await validation.validateLandOwnershipPolygonRequest(request.query);

    if (validation.fail()) {
        return h.response(validation.errors).code(400);
    }

    try {

        const payload: any = request.query;

        const polygon = await query.getPolygon(
            payload.sw_lng,
            payload.sw_lat,
            payload.ne_lng,
            payload.ne_lat,
        );

        return h.response(polygon).code(200);

    } catch (err: any) {
        console.log(err.message);
        return h.response("internal server error!").code(500);
    }
}

type PublicMapRequest = Request & {
    payload: {
        mapId: number
    },
    auth: {
        artifacts: {
            user_id: number
        }
    }
}

type FileResponseToolkit = ResponseToolkit & {
    file: Function;
}

async function downloadMap(request: PublicMapRequest, h: FileResponseToolkit): Promise<ResponseObject> {
    const { mapId } = request.params;
    const { user_id } = request.auth.artifacts;

    const userMap = await Model.UserMap.findOne({
        where: {
            user_id,
            map_id: mapId
        }
    });
    if (!userMap)
        return h.response({ success: false, message: "User account doesn't have read access to that map" });

    const map = await Model.Map.findOne({
        where: {
            id: mapId
        }
    });

    const mapData = JSON.parse(map.data);

    const polygons = mapData.drawings.polygons.map((polygon: any) => {
        polygon.data.properties = { name: polygon.name, length: polygon.length, area: polygon.area };
        return polygon.data;
    });
    const markers = mapData.markers.markers.map((marker: any) => ({
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: marker.coordinates
        },
        properties: {
            name: marker.name
        }
    }));

    const dataGroupMarkers: any[] = [];

    for (let layer of mapData.mapLayers.myDataLayers) {
        const markers = await Model.Marker.findAll({
            data_group_id: layer.iddata_groups
        });

        markers.forEach((marker: any) => {
            dataGroupMarkers.push({
                type: "Feature",
                geometry: marker.location,
                properties: {
                    name: marker.name,
                    description: marker.description,
                    group: layer.title
                }
            })
        });
    }

    const features = [...polygons, ...markers, ...dataGroupMarkers];

    const shapeFileLocation = `./data/shapefiles/${map.name}-${Date.now()}.zip`;

    const { convert } = require('geojson2shp');
    const convertOptions = {
        layer: 'land-explorer-layer',
        targetCrs: 2154
    };

    //create a new shapefile in the shape file location
    await convert(features, shapeFileLocation, convertOptions);

    const response = h.file(shapeFileLocation, {
        mode: 'attachment'
    });

    const deleteFile = () => {
        const fs = require('fs');
        fs.unlink(shapeFileLocation, (error: any) => {
            if (error)
                console.log(error)
        });
    }

    setTimeout(deleteFile, 1000);

    return response;
}

async function setMapPublic(request: PublicMapRequest, h: ResponseToolkit): Promise<ResponseObject> {
    const { mapId } = request.payload;
    const { user_id } = request.auth.artifacts;

    const publicMapAddress = await createPublicMapView(mapId, user_id);

    return h.response(publicMapAddress);
}

async function getPublicMap(request: Request, h: ResponseToolkit): Promise<ResponseObject> {
    const { mapId } = request.params;

    const publicMapView = await findPublicMap(mapId);

    return h.response(publicMapView);
}

export const mapRoutes: ServerRoute[] = [
    { method: "POST", path: "/api/user/map/save/", handler: saveMap },
    { method: "POST", path: "/api/user/map/view/", handler: setMapAsViewed },
    { method: "POST", path: "/api/user/map/share/sync/", handler: mapSharing },
    { method: "POST", path: "/api/user/map/delete/", handler: deleteMap },
    { method: "POST", path: "/api/user/map/share/public", handler: setMapPublic },
    { method: "GET", path: "/api/user/map/download/{mapId}", handler: downloadMap },
    { method: "GET", path: "/api/user/maps/", handler: getUserMaps },
    { method: "GET", path: "/api/ownership/", handler: getLandOwnershipPolygon },
    // public method to see maps
    { method: "GET", path: "/api/public/map/{mapId}", handler: getPublicMap, options: { auth: false } },
];
