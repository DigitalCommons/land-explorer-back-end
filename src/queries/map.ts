import { Map, UserMap, Marker, MapMembership } from './database';

const createMarker = async (name: string, description: string, coordinates: number[], mapId: number) => {
    const lastMarker = await Marker.findOne({
        order: [['idmarkers', 'DESC']],
    })

    const newMarkerId = lastMarker ? lastMarker.idmarkers + 1 : 0;

    return await Marker.create({
        idmarkers: newMarkerId,
        name: name,
        description: description,
        data_group_id: -1,
        location: {
            type: "Point",
            coordinates: coordinates
        }
    })
}

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
        markers.push({
            id: marker.idmarkers,
            coordinates: marker.location.coordinates,
            name: marker.name,
            description: marker.description
        });
    }

    return markers;
}

const createMapMembership = async (mapId: number, itemTypeId: number, itemId: number) => {
    const lastMapMembership = await MapMembership.findOne({
        order: [['idmap_memberships', 'DESC']],
    })

    const newMapMembershipId = lastMapMembership ? lastMapMembership.idmap_memberships + 1 : 0;

    await MapMembership.create({
        idmap_memberships: newMapMembershipId,
        map_id: mapId,
        item_type_id: itemTypeId,
        item_id: itemId
    })
}

type CreateMapFunction = (name: string, data: any, userId: number) => Promise<void>;

export const createMap: CreateMapFunction = async (name, data, userId) => {
    const mapData = await JSON.parse(data);
    mapData.markersInDB = true; //this is used in loading maps, so that the markers aren't loaded twice

    const newMap = await Map.create({
        name: name,
        data: JSON.stringify(mapData),
        deleted: 0
    });

    await UserMap.create({
        map_id: newMap.id,
        user_id: userId,
        access: 2 // 1 = readonly, 2 = readwrite
    });

    const markers = mapData.markers.markers;

    for (const marker of markers) {
        const newMarker = await createMarker(marker.name, marker.description, marker.coordinates, newMap.id)
        await createMapMembership(newMap.id, 0, newMarker.idmarkers)
    }

    // next: repeat the above for polygons and lines
}

type MapUpdateFunction = (eid: number, name: string, data: any) => Promise<void>;

export const updateMap: MapUpdateFunction = async (mapId, name, data) => {
    const mapData = await JSON.parse(data);

    console.log(mapData)
    console.log(mapData.markers.markers)

    if (mapData.map.markersInDB) {
        console.log("delete old")
        await MapMembership.destroy({
            where: {
                map_id: mapId
            }
        });
    }
    else {
        mapData.markersInDB = true;
    }

    console.log(mapData)

    /*
    const markers = mapData.markers.markers;

    for (const marker of markers) {
        const newMarker = await createMarker(marker.name, marker.description, marker.coordinates, mapId);
        await createMapMembership(mapId, 0, newMarker.idmarkers);
    }

    */

    await Map.update(
        {
            name: name,
            data: JSON.stringify(mapData),
        },
        {
            where: {
                id: mapId
            }
        }
    );


    return;

}