import { User, Map, UserMap, UserMapAccess, PendingUserMap, polygonDbSequelize, Marker, DataGroup, DataGroupMembership, UserGroup, UserGroupMembership } from './database';

const { QueryTypes } = require('sequelize');
const {
  sequelize,
  User,
  Map,
  UserMap,
  PendingUserMap,
  polygonDbSequelize,
  Marker,
  DataGroup,
  DataGroupMembership,
  UserGroup,
  UserGroupMembership
} = require('./database');
const bcrypt = require('bcrypt');
const helper = require('./helpers');

export const getUser = async (options = {}) => {
  let result = await User.findOne(options);

  return result;
}

/**
 * 
 * @param id 
 * @returns 
 */
export const getUserById = async (id: number, options: any = {}): Promise<typeof User | null> => {
  return await User.findByPk(id, options);
}

/**
 * Check whether user with the given username exist
 * 
 * @param username 
 * @returns 
 */
export const usernameExist = async (username: string): Promise<Boolean> => {
  return (await User.findOne({ where: { username: username } })) !== null;
}

/**
 * Register user with data from API request.
 * Data should already be validated.
 * 
 * @param data
 * @returns 
 */
export const registerUser = async (data: any) => {

  return await User.create({
    username: data.username,
    password: helper.hashPassword(data.password),
    enabled: 1,
    access: 2,
    is_super_user: 0,
    first_name: data.firstName,
    last_name: data.lastName,
    address1: data.address1,
    address2: data.address2,
    postcode: data.postcode,
    phone: data.phone,
    organisation_number: data.organisationNumber,
    organisation: data.organisation,
    organisation_activity: data.organisationSubType,
    organisation_type: data.organisationType,
    marketing: data.marketing,
    council_id: data.username.endsWith("rbkc.gov.uk") ? 1 : 0
  });
}

/**
 * Before a user is registered, other existing user may have shared a map to this user.
 * These map are stored in 'pending_user_map'. Now that a given user is registered,
 * we migrate the map to 'user_map'
 * 
 * @param user 
 * @returns 
 */
export const migrateGuestUserMap = async (user: typeof User) => {

  try {

    const userMapData = (await PendingUserMap
      .findAll({
        where: {
          email_address: user.username
        }
      }))
      // map to format ready to be inserted to user_map table
      .map(function (pendingUserMap: any) {
        return {
          access: UserMapAccess.Readonly,
          viewed: 0,
          map_id: pendingUserMap.map_id,
          user_id: user.id
        }
      });

    // bulk create the user map
    await UserMap.bulkCreate(userMapData);

    // Now delete user map from pendingUserMap
    await PendingUserMap.destroy({
      where: {
        email_address: user.username
      }
    });

  } catch (error: any) {
    console.log(error.message);
  }
}


/**
 * 
 * @param username 
 * @param password 
 * @returns User
 */
export async function checkUser(username: string, password: string): Promise<typeof User | false> {

  const user = await getUser({ where: { username: username }, raw: true });

  if (user == null) {
    return false;
  }

  const match = await bcrypt.compare(password, user.password);

  if (match) {
    return user;
  }

  return false;
}

/**
 * Return the geojson polygons of land ownership within a given bounding box area 
 * @param username 
 * @param password 
 * @returns User
 */
export async function getPolygon(sw_lng: number, sw_lat: number, ne_lng: number, ne_lat: number) {

  const x1 = sw_lng;
  const y1 = sw_lat;

  const x2 = ne_lng;
  const y2 = sw_lat;

  const x3 = ne_lng;
  const y3 = ne_lat;

  const x4 = sw_lng;
  const y4 = ne_lat;

  const searchArea = "POLYGON ((" + x1 + " " + y1 + ", " + x2 + " " + y2 + ", " + x3 + " " + y3 + ", " + x4 + " " + y4 + ", " + x1 + " " + y1 + "))";

  const query = `SELECT 
  lop.id as id, 
  lop.poly_id as poly_id, 
  lop.title_no as title_no, 
  ST_AsGeoJSON(geom) as geojson, 
  lo.tenure as tenure,
  lo.property_address as property_address,
  lo.district as district,
  lo.county as county,
  lo.region as region,
  lo.postcode as postcode,
  lo.multiple_address_indicator as multiple_address_indicator,

  lo.proprietor_name_1 as proprietor_name_1,
  lo.company_registration_no_1 as company_registration_no_1,
  lo.proprietor_category_1 as proprietor_category_1,
  lo.proprietor_1_address_1 as proprietor_1_address_1,
  lo.proprietor_1_address_2 as proprietor_1_address_2,
  lo.proprietor_1_address_3 as proprietor_1_address_3,

  lo.proprietor_name_2 as proprietor_name_2,
  lo.company_registration_no_2 as company_registration_no_2,
  lo.proprietor_category_2 as proprietor_category_2,
  lo.proprietor_2_address_1 as proprietor_2_address_1,
  lo.proprietor_2_address_2 as proprietor_2_address_2,
  lo.proprietor_2_address_3 as proprietor_2_address_3,

  lo.proprietor_name_3 as proprietor_name_3,
  lo.company_registration_no_3 as company_registration_no_3,
  lo.proprietor_category_3 as proprietor_category_3,
  lo.proprietor_3_address_1 as proprietor_3_address_1,
  lo.proprietor_3_address_2 as proprietor_3_address_2,
  lo.proprietor_3_address_3 as proprietor_3_address_3,

  lo.proprietor_name_4 as proprietor_name_4,
  lo.company_registration_no_4 as company_registration_no_4,
  lo.proprietor_category_4 as proprietor_category_4,
  lo.proprietor_4_address_1 as proprietor_4_address_1,
  lo.proprietor_4_address_2 as proprietor_4_address_2,
  lo.proprietor_4_address_3 as proprietor_4_address_3,

  lo.date_proprietor_added as date_proprietor_added,
  lo.additional_proprietor_indicator as additional_proprietor_indicator

  FROM land_ownership_polygon lop
  LEFT JOIN land_ownerships lo
  ON lop.title_no = lo.title_no
  WHERE ST_Intersects(lop.geom, ST_GeomFromText("` + searchArea + `"))`;

  return await polygonDbSequelize.query(query, { type: QueryTypes.SELECT });
}

/* 
  Data groups and their contents
*/

export async function findDataGroupsByUserId(userId: number) {
  const user = await User.findOne({
    where: {
      id: userId
    }
  });

  const userGroupMemberships = await UserGroupMembership.findAll({
    where: {
      user_id: user.id
    }
  });

  const userGroups: any[] = [];

  for (let membership of userGroupMemberships) {
    userGroups.push(await UserGroup.findOne({
      where: {
        iduser_groups: membership.user_group_id
      }
    }))
  }

  const userGroupsAndData: any[] = [];

  for (let group of userGroups) {
    const dataGroupMemberships = await DataGroupMembership.findAll({
      where: {
        user_group_id: group.iduser_groups
      }
    })

    let dataGroups: any[] = [];

    for (let membership of dataGroupMemberships) {
      dataGroups = dataGroups.concat(
        await DataGroup.findAll({
          where: {
            iddata_groups: membership.data_group_id
          }
        })
      )
    }

    for (let dataGroup of dataGroups) {
      dataGroup.dataValues.markers = await Marker.findAll({
        where: {
          data_group_id: dataGroup.iddata_groups
        }
      })
    }

    userGroupsAndData.push({
      name: group.name,
      id: group.iduser_groups,
      dataGroups
    })
  }

  return userGroupsAndData;
}


/* Queries for the public map views  */

const publicUserId = -1;

export async function findPublicMap(mapId: number) {
  const publicMapView = await UserMap.findOne({
    where: {
      map_id: mapId,
      user_id: publicUserId
    }
  })

  if (publicMapView) {
    const publicMap = await Map.findOne({
      where: {
        id: mapId
      }
    });

    publicMap.data = JSON.parse(publicMap.data);

    for (let dataGroup of publicMap.data.mapLayers.myDataLayers) {
      dataGroup.markers = await Marker.findAll({
        where: {
          data_group_id: dataGroup.iddata_groups
        }
      });
    }

    return publicMap;
  }
  else
    return "No public map at this address."
}

export async function createPublicMapView(mapId: number, userId: number) {
  const userMapView = await UserMap.findOne({
    where: {
      map_id: mapId,
      user_id: userId
    }
  });

  const readAccess = 1;
  const readWriteAccess = 2;

  if (userMapView.access == readWriteAccess) {
    const publicViewExists = await UserMap.findOne({
      where: {
        map_id: mapId,
        user_id: publicUserId,
        access: readAccess,
      }
    });

    if (!publicViewExists) {
      await UserMap.create({
        map_id: mapId,
        user_id: publicUserId,
        access: readAccess,
        viewed: 0
      });
    }

    return {
      success: true,
      message: "Made map public",
      URI: `/api/public/map/${mapId}`
    };
  }
  else {
    return {
      success: false,
      message: "You don't have write access to this map, so can't make it public."
    };
  }
}