import { User, Map, UserMap, UserMapAccess, PendingUserMap, PasswordResetToken, polygonDbSequelize, Marker, Polygon, Line, DataGroup, DataGroupMembership, UserGroup, UserGroupMembership } from './database';
import { getMapMarkers, getMapPolygonsAndLines } from '../queries/map';
import { hashPassword } from './helper';
import bcrypt from 'bcrypt';
import { QueryTypes } from 'sequelize';
import axios from 'axios';

export const getUser = async (options = {}) => {
  let result = await User.findOne(options);

  return result;
}

export const getUserById = async (id: number, options: any = {}): Promise<typeof User | null> => {
  return await User.findByPk(id, options);
}

/**
 * Check whether user with the given username exists
 */
export const usernameExist = async (username: string): Promise<Boolean> => {
  return (await User.findOne({ where: { username: username } })) !== null;
}

/**
 * Register user with data from API request.
 * Data should already be validated.
 */
export const createUser = async (data: any) => {
  if (data.marketing) {
    axios.post("https://api.buttondown.email/v1/subscribers", {
      email: data.username,
      referrer_url: "https://app.landexplorer.coop/register"
    }, {
      headers: {
        'Authorization': `Token ${process.env.BUTTONDOWN_API_KEY}`
      }
    })
  }

  return await User.create({
    username: data.username,
    password: hashPassword(data.password),
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
 * Return the user if they exist and the password (or reset token) matches, otherwise return false.
 */
export const checkAndReturnUser = async (username: string, password?: string, reset_token?: string): Promise<typeof User | false> => {
  const user = await getUser({ where: { username: username }, raw: true });

  if (!user) {
    return false;
  }

  if (reset_token) {
    // Logging in via the reset password flow
    const result = await PasswordResetToken.findOne({
      where: { user_id: user.id }
    });

    if (result) {
      // Destroy one-time token
      await PasswordResetToken.destroy({
        where: { user_id: user.id }
      });

      // Check that token matches and has not expired
      const match = result.token === reset_token && result.expires > Date.now();

      if (match) {
        return user;
      }
    }
  } else if (password) {
    const match = await bcrypt.compare(password, user.password);

    if (match) {
      return user;
    }
  }

  return false;
}

/**
 * Return the geojson polygons of land ownership within a given bounding box area 
 */
export const getPolygon = async (sw_lng: number, sw_lat: number, ne_lng: number, ne_lat: number) => {

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

export const findAllDataGroupContentForUser = async (userId: number) => {
  const userGroupMemberships = await UserGroupMembership.findAll({
    where: {
      user_id: userId
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
      });
      dataGroup.dataValues.polygons = await Polygon.findAll({
        where: {
          data_group_id: dataGroup.iddata_groups
        }
      });
      dataGroup.dataValues.lines = await Line.findAll({
        where: {
          data_group_id: dataGroup.iddata_groups
        }
      });
    }

    userGroupsAndData.push({
      name: group.name,
      id: group.iduser_groups,
      dataGroups
    })
  }

  return userGroupsAndData;
}

export const hasAccessToDataGroup = async (userId: number, dataGroupId: number): Promise<boolean> => {
  const userGroupMemberships = await UserGroupMembership.findAll({
    where: {
      user_id: userId
    }
  });

  for (let membership of userGroupMemberships) {
    const dataGroupMembership = await DataGroupMembership.findOne({
      where: {
        user_group_id: membership.user_group_id,
        data_group_id: dataGroupId
      }
    });

    if (dataGroupMembership) {
      return true;
    }
  }

  return false;
}

/**
 * Get a GeoJSON feature collection containing all the markers, polys and lines in a map, including
 * those in active data groups.
 */
export const getGeoJsonFeaturesForMap = async (mapId: number) => {
  const map = await Map.findOne({
    where: {
      id: mapId
    }
  });
  const mapData = JSON.parse(map.data);

  // Get markers, polygons and lines that are saved to the map
  const markers = await getMapMarkers(mapId);
  const markerFeatures = markers.map((marker: any) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: marker.coordinates
    },
    properties: {
      name: marker.name,
      description: marker.description,
      group: 'My Drawings'
    }
  }));

  const polygonsAndLines = await getMapPolygonsAndLines(mapId);
  const polygonAndLineFeatures = polygonsAndLines.map((polygon: any) => ({
    ...polygon.data,
    properties: {
      name: polygon.name,
      description: polygon.description,
      group: 'My Drawings'
    }
  }));

  // Get features from datagroup layers which are active
  const dataGroupFeatures: any[] = [];
  for (const dataGroupId of mapData.mapLayers.myDataLayers) {
    const dataGroup = await DataGroup.findOne({
      where: {
        // In old maps, myDataLayers used to be array of objects, each with an iddata_groups
        // field. In newer maps, myDataLayers is just an array of data group IDs.
        iddata_groups: dataGroupId.iddata_groups || dataGroupId
      }
    });
    const dataGroupMarkers = await Marker.findAll({
      where: {
        data_group_id: dataGroupId.iddata_groups || dataGroupId
      }
    });
    const dataGroupPolygons = await Polygon.findAll({
      where: {
        data_group_id: dataGroupId.iddata_groups || dataGroupId
      }
    });
    const dataGroupLines = await Line.findAll({
      where: {
        data_group_id: dataGroupId.iddata_groups || dataGroupId
      }
    });

    dataGroupMarkers.forEach((marker: any) => {
      dataGroupFeatures.push({
        type: "Feature",
        geometry: marker.location,
        properties: {
          name: marker.name,
          description: marker.description,
          group: dataGroup.title
        }
      })
    });
    dataGroupPolygons.forEach((polygon: any) => {
      dataGroupFeatures.push({
        type: "Feature",
        geometry: polygon.vertices,
        properties: {
          name: polygon.name,
          description: polygon.description,
          group: dataGroup.title
        }
      })
    });
    dataGroupLines.forEach((line: any) => {
      dataGroupFeatures.push({
        type: "Feature",
        geometry: line.vertices,
        properties: {
          name: line.name,
          description: line.description,
          group: dataGroup.title
        }
      })
    });
  }

  return {
    type: "FeatureCollection",
    features: [...markerFeatures, ...polygonAndLineFeatures, ...dataGroupFeatures]
  };
}

/**
 * Make a specified map available to the public.
 * @returns URI for the public map view
 */
export const createPublicMapView = async (mapId: number): Promise<string> => {
  const publicUserId = -1;

  const publicViewExists = await UserMap.findOne({
    where: {
      map_id: mapId,
      user_id: publicUserId,
    }
  });

  if (!publicViewExists) {
    await UserMap.create({
      map_id: mapId,
      user_id: publicUserId,
      access: UserMapAccess.Readonly,
      viewed: 0
    });
  }

  return `/api/public/map/${mapId}`;
}
