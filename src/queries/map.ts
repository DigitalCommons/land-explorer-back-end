import { Map, UserMap } from './database';

type CreateMapFunction = (name: string, data: any, userId: number) => Promise<void>;

export const createMap: CreateMapFunction = async (name, data, userId) => {
    const newMap = await Map.create({
        name: name,
        data: data,
        deleted: 0
    });

    await UserMap.create({
        map_id: newMap.id,
        user_id: userId,
        access: 2 // 1 = readonly, 2 = readwrite
    });

    //loop through data to find markers, then create the marker and map_membership, 
    //using the item_type of marker
    //which means adding the item_type to the seeder, right? which i have now done


}

type MapUpdateFunction = (eid: number, name: string, data: any) => Promise<void>;

export const updateMap: MapUpdateFunction = async (eid, name, data) => {
    await Map.update(
        {
            name: name,
            data: data,
        },
        {
            where: {
                id: eid
            }
        }
    );
}