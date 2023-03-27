
import { Map, UserMap, UserMapAccess, Marker, Polygon, Line, MapMembership, ItemTypeId } from './database';
import { createMarker, createPolygon, createLine } from './object';
import { v4 as uuidv4 } from 'uuid';

export const getMapMarkers = async (mapId: number) => {
    const mapMemberships = await MapMembership.findAll({
        where: {
            map_id: mapId,
            item_type_id: ItemTypeId.Marker
        }
    });

    const markers = [];

    for (const mapMembership of mapMemberships) {
        const marker = await Marker.findOne({
            where: {
                idmarkers: mapMembership.item_id
            }
        });
        // Form JSON that is used by front end
        markers.push({
            uuid: marker.uuid,
            coordinates: marker.location.coordinates,
            name: marker.name,
            description: marker.description
        });
    }

    console.log(`Got ${markers.length} markers for map ${mapId}`);
    return markers;
}


export const getMapPolygonsAndLines = async (mapId: number) => {
    const mapPolygonMemberships = await MapMembership.findAll({
        where: {
            map_id: mapId,
            item_type_id: ItemTypeId.Polygon
        }
    });
    const mapLineMemberships = await MapMembership.findAll({
        where: {
            map_id: mapId,
            item_type_id: ItemTypeId.Line
        }
    });

    const polygonsAndLines = [];

    // Add polygons
    for (const mapMembership of mapPolygonMemberships) {
        const polygon = await Polygon.findOne({
            where: {
                idpolygons: mapMembership.item_id
            }
        });
        polygonsAndLines.push({
            item_id: polygon.idpolygons,
            name: polygon.name,
            description: polygon.description,
            type: "Polygon",
            // Form GeoJSON that is used by front end
            data: {
                id: polygon.uuid,
                type: 'Feature',
                properties: {},
                geometry: { type: 'Polygon', coordinates: polygon.vertices.coordinates }
            },
            center: polygon.center.coordinates,
            length: polygon.length,
            area: polygon.area,
            uuid: polygon.uuid,
        });
    }
    const numPolygons = polygonsAndLines.length;

    // Add lines
    for (const mapMembership of mapLineMemberships) {
        const line = await Line.findOne({
            where: {
                idlinestrings: mapMembership.item_id
            }
        });
        polygonsAndLines.push({
            item_id: line.idlinestrings,
            name: line.name,
            description: line.description,
            type: "LineString",
            // Form GeoJSON that is used by front end
            data: {
                id: line.uuid,
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: line.vertices.coordinates }
            },
            length: line.length,
            uuid: line.uuid,
        });
    }
    const numLines = polygonsAndLines.length - numPolygons;

    console.log(`Got ${numPolygons} polygons and ${numLines} lines for map ${mapId}`);
    return polygonsAndLines;
}

export const createMapMembership = async (mapId: number, itemTypeId: number, itemId: number) => {
    await MapMembership.create({
        map_id: mapId,
        item_type_id: itemTypeId,
        item_id: itemId
    })
}

/* Save array of markers to DB for a given map. */
const saveMarkers = async (mapId: number, markers: Array<any>) => {
    for (const m of markers) {
        const newMarker = await createMarker(m.name, m.description, m.coordinates, m.uuid || uuidv4());
        await createMapMembership(mapId, ItemTypeId.Marker, newMarker.idmarkers);
    }
}

/* Save array of polygons and lines to DB for a given map. */
const savePolygonsAndLines = async (mapId: number, polygonsAndLines: Array<any>) => {
    for (const p of polygonsAndLines) {
        if (p.type === "Polygon") {
            const newPolygon = await createPolygon(
                p.name, p.description, p.data.geometry.coordinates, p.center, p.length, p.area, p.data.id || uuidv4()
            );
            await createMapMembership(mapId, ItemTypeId.Polygon, newPolygon.idpolygons);
        } else {
            const newLine = await createLine(
                p.name, p.description, p.data.geometry.coordinates, p.length, p.data.id || uuidv4()
            );
            await createMapMembership(mapId, ItemTypeId.Line, newLine.idlinestrings);
        }
    }
}

/* Copy all data group objects to a specified map. */
const copyDataGroupObjects = async (mapId: number, dataLayers: any) => {
    for (const dataLayer of dataLayers) {
        const dataGroupMarkers = await Marker.findAll({
            where: {
                data_group_id: dataLayer.iddata_groups
            }
        });
        await saveMarkers(mapId, dataGroupMarkers.map((marker: any) => ({
            name: marker.name,
            description: marker.description,
            coordinates: marker.location.coordinates,
            uuid: uuidv4()
        })));

        const dataGroupPolygons = await Polygon.findAll({
            where: {
                data_group_id: dataLayer.iddata_groups
            }
        });
        for (const polygon of dataGroupPolygons) {
            const newPolygon = await createPolygon(polygon.name, polygon.description, polygon.vertices.coordinates, polygon.center.coordinates, polygon.length, polygon.area, uuidv4());
            await createMapMembership(mapId, ItemTypeId.Polygon, newPolygon.idpolygons);
        }

        const dataGroupLines = await Line.findAll({
            where: {
                data_group_id: dataLayer.iddata_groups
            }
        });
        for (const line of dataGroupLines) {
            const newLine = await createLine(line.name, line.description, line.vertices.coordinates, line.length, uuidv4());
            await createMapMembership(mapId, ItemTypeId.Line, newLine.idlinestrings);
        }
    }
}

type CreateMapFunction = (name: string, data: any, userId: number, isSnapshot: boolean) => Promise<void>;

export const createMap: CreateMapFunction = async (name, data, userId, isSnapshot) => {
    const mapData = await JSON.parse(data);

    // Saving drawings to DB separately so can remove from JSON
    const markers = mapData.markers.markers;
    const polygonsAndLines = mapData.drawings.polygons;
    mapData.markers.markers = [];
    mapData.drawings.polygons = [];
    mapData.drawingsInDB = true;

    const myDataLayers = JSON.parse(JSON.stringify(mapData.mapLayers.myDataLayers));
    if (isSnapshot)
        mapData.mapLayers.myDataLayers = [];

    const newMap = await Map.create({
        name: name,
        data: JSON.stringify(mapData),
        deleted: 0,
        is_snapshot: isSnapshot
    });

    await UserMap.create({
        map_id: newMap.id,
        user_id: userId,
        access: UserMapAccess.Readwrite
    });

    await saveMarkers(newMap.id, markers);

    await savePolygonsAndLines(newMap.id, polygonsAndLines);

    if (isSnapshot) {
        await copyDataGroupObjects(newMap.id, myDataLayers);
    }
}

type MapUpdateFunction = (eid: number, name: string, data: any) => Promise<void>;

export const updateMap: MapUpdateFunction = async (mapId, name, data) => {
    const existingMap = await Map.findOne({
        where: {
            id: mapId
        }
    });

    const existingMapData = await JSON.parse(existingMap.data);
    const newMapData = await JSON.parse(data);

    if (existingMapData.drawingsInDB) {
        // TODO: Reduce number of DB operations by only adding and removing markers that have changed

        const mapMemberships = await MapMembership.findAll({
            where: { map_id: mapId }
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

        console.log(`Removing ${markerIds.length} markers from DB for map ${mapId}`);
        await Marker.destroy({
            where: { idmarkers: markerIds }
        });

        console.log(`Removing ${polygonIds.length} polygons from DB for map ${mapId}`);
        await Polygon.destroy({
            where: { idpolygons: polygonIds }
        });

        console.log(`Removing ${lineIds.length} lines from DB for map ${mapId}`);
        await Line.destroy({
            where: { idlinestrings: lineIds }
        });

        await MapMembership.destroy({
            where: { map_id: mapId }
        });
    }

    console.log(`Adding ${newMapData.markers.markers.length} markers to DB for map ${mapId}`);
    await saveMarkers(mapId, newMapData.markers.markers);
    console.log(`Adding ${newMapData.drawings.polygons.length} polygons/lines to DB for map ${mapId}`);
    await savePolygonsAndLines(mapId, newMapData.drawings.polygons);

    // Remove drawings from data since they are now in the DB
    newMapData.markers.markers = [];
    newMapData.drawings.polygons = [];
    newMapData.drawingsInDB = true;

    await Map.update(
        {
            name: name,
            data: JSON.stringify(newMapData),
        },
        {
            where: {
                id: mapId
            }
        }
    );
}
