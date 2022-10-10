import { Map, UserMap, UserMapAccess, Marker, MapMembership, ItemTypeId } from './database';

export const getMapMarkers = async (mapId: number) => {
    const mapMemberships = await MapMembership.findAll({
        where: {
            map_id: mapId
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

    return markers;
}

const createMapMembership = async (mapId: number, itemTypeId: number, itemId: number) => {
    await MapMembership.create({
        map_id: mapId,
        item_type_id: itemTypeId,
        item_id: itemId
    })
}

const createMarker = async (name: string, description: string, coordinates: number[], uuid: string
) => {
    return await Marker.create({
        name: name,
        description: description,
        data_group_id: -1,
        location: {
            type: "Point",
            coordinates: coordinates
        },
        uuid: uuid
    })
}

/* Save array of markers to DB for a given map. */
const saveMarkers = async (mapId: number, markers: Array<any>) => {
    for (const m of markers) {
        const newMarker = await createMarker(m.name, m.description, m.coordinates, m.uuid);
        await createMapMembership(mapId, ItemTypeId.Marker, newMarker.idmarkers);
    }
}

type CreateMapFunction = (name: string, data: any, userId: number) => Promise<void>;

export const createMap: CreateMapFunction = async (name, data, userId) => {
    const mapData = await JSON.parse(data);

    // Saving drawings to DB separately so can remove from JSON
    const markers = mapData.markers.markers;
    mapData.markers.markers = [];
    mapData.drawingsInDB = true;

    const newMap = await Map.create({
        name: name,
        data: JSON.stringify(mapData),
        deleted: 0
    });

    await UserMap.create({
        map_id: newMap.id,
        user_id: userId,
        access: UserMapAccess.Readwrite
    });

    await saveMarkers(newMap.id, markers);

    // next: repeat the above for polygons and lines
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

        console.log(`Removing ${mapMemberships.length} markers from DB for map ${mapId}`);
        await MapMembership.destroy({
            where: { map_id: mapId }
        });

        const markerIds = mapMemberships.map(({ item_id }: { item_id: number }) => item_id)

        await Marker.destroy({
            where: { idmarkers: markerIds }
        });
    }

    console.log(`Adding ${newMapData.markers.markers.length} markers to DB for map ${mapId}`)
    await saveMarkers(mapId, newMapData.markers.markers);

    // Remove drawings from data since they are now in the DB
    newMapData.markers.markers = [];
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
