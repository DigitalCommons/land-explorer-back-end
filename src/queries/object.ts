import { Marker, Polygon, Line, DataGroupId } from './database';

export const createMarker = async (name: string, description: string, coordinates: number[], uuid: string, data_group_id: number = DataGroupId.None
) => {
    return await Marker.create({
        name: name,
        description: description,
        data_group_id: data_group_id,
        location: {
            type: "Point",
            coordinates: coordinates
        },
        uuid: uuid
    })
}

export const createPolygon = async (
    name: string, description: string, vertices: number[][], center: number[], length: number, area: number, uuid: string, data_group_id: number = DataGroupId.None
) => {
    return await Polygon.create({
        name: name,
        description: description,
        data_group_id: data_group_id,
        vertices: {
            type: "Polygon",
            coordinates: vertices
        },
        center: {
            type: "Point",
            coordinates: center
        },
        length: length,
        area: area,
        uuid: uuid
    })
}

export const createLine = async (
    name: string, description: string, vertices: number[][], length: number, uuid: string, data_group_id: number = DataGroupId.None
) => {
    return await Line.create({
        name: name,
        description: description,
        data_group_id: data_group_id,
        vertices: {
            type: "LineString",
            coordinates: vertices
        },
        length: length,
        uuid: uuid
    })
}

export const updateMarker = async (uuid: string, name: string, description: string) => {
    await Marker.update(
        {
            name: name,
            description: description
        },
        {
            where: {
                uuid: uuid
            }
        }
    );
}

export const updatePolygon = async (uuid: string, name: string, description: string) => {
    await Polygon.update(
        {
            name: name,
            description: description
        },
        {
            where: {
                uuid: uuid
            }
        }
    );
}

export const updateLine = async (uuid: string, name: string, description: string) => {
    await Line.update(
        {
            name: name,
            description: description
        },
        {
            where: {
                uuid: uuid
            }
        }
    );
}
