// TODO: separate the functions in this file into more appropriate filenames
import {
  User,
  UserMap,
  PendingUserMap,
  PasswordResetToken,
  Marker,
  Polygon,
  Line,
  DataGroup,
  DataGroupMembership,
  UserGroup,
  UserGroupMembership,
  UserFeedback,
  UserGroupAccess,
  sequelize,
} from "./database";
import { hashPassword } from "./helper";
import bcrypt from "bcrypt";
import { createHash } from "node:crypto";
import axios from "axios";
import { Op, QueryTypes } from "sequelize";
import { EventName, trackRawEvent } from "../instrument";

export const getUserById = async (id: number): Promise<typeof User | null> => {
  return await User.findOne({ where: { id } });
};

export const getUserInitials = async (id: number): Promise<string | null> => {
  const user: any = await User.findOne({ where: { id } });
  return user === null
    ? null
    : (user.first_name || "?")[0].toUpperCase() +
        (user.last_name || "?")[0].toUpperCase();
};

/**
 * Return the user if its email username exists, otherwise null.
 *
 * The search is case-insensitive, which we want for emails, since the default MySQL collation is
 * case-insensitive.
 */
export const getUserByEmail = async (email: string) => {
  return await User.findOne({
    where: {
      username: email,
    },
    raw: true,
  });
};

/**
 * Check whether user with the given username exists (case-insensitive)
 */
export const usernameExist = async (username: string): Promise<Boolean> => {
  return (await getUserByEmail(username)) !== null;
};

/**
 * Register user with data from API request.
 * Data should already be validated.
 */
export const createUser = async (data: any) => {
  if (data.marketing) {
    axios.post(
      "https://api.buttondown.email/v1/subscribers",
      {
        email: data.username,
        referrer_url: "https://app.landexplorer.coop/register",
      },
      {
        headers: {
          Authorization: `Token ${process.env.BUTTONDOWN_API_KEY}`,
        },
      }
    );
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
    council_id: data.username.endsWith("rbkc.gov.uk") ? 1 : 0,
  });
};

/**
 * Before a user is registered, other existing users may have shared a map to this user. This
 * sharing data is stored in 'pending_user_map'. Now that a given user is registered, we migrate the
 * pending user maps to 'user_map'.
 *
 * @returns The number of maps that were shared with the user and migrated
 */
export const migrateGuestUserMap = async (
  user: typeof User
): Promise<number> => {
  const userMapData = (
    await PendingUserMap.findAll({
      where: {
        email_address: user.username,
      },
    })
  )
    // map to format ready to be inserted to user_map table
    .map((pendingUserMap: any) => {
      return {
        access: pendingUserMap.access,
        viewed: 0,
        map_id: pendingUserMap.map_id,
        user_id: user.id,
      };
    });

  const mapsCount = userMapData.length;

  // bulk create the user map
  await UserMap.bulkCreate(userMapData);

  // Now delete user map from pendingUserMap
  await PendingUserMap.destroy({
    where: {
      email_address: user.username,
    },
  });

  return mapsCount;
};

/**
 * Return the user if they exist and the password (or reset token) matches, otherwise return an
 * error message.
 */
export const checkAndReturnUser = async (
  username: string,
  password?: string,
  reset_token?: string
) => {
  const user = await getUserByEmail(username);

  if (reset_token) {
    // Logging in via the reset password flow

    if (user) {
      const result = await PasswordResetToken.findOne({
        where: { user_id: user.id },
      });

      if (result) {
        // Destroy one-time token
        await PasswordResetToken.destroy({
          where: { user_id: user.id },
        });

        const expired = Date.now() > result.expires;
        if (expired) {
          return {
            success: false,
            errorMessage:
              "Link has expired. Please make a new password reset request.",
          };
        }

        const match = result.token === reset_token;
        if (match) {
          return {
            success: true,
            user: user,
          };
        }
      }
    }

    return {
      success: false,
      errorMessage: "Password reset link is invalid.",
    };
  } else if (password && user) {
    const match = await bcrypt.compare(password, user.password);

    if (match) {
      return {
        success: true,
        user: user,
      };
    }
  }

  return {
    success: false,
    errorMessage: "You have entered an invalid username or password.",
  };
};

/**
 * Convert a userId to a hashed value, using their username as a salt and then adding the secret
 * pepper, to anonymize it for analytics.
 */
export const hashUserId = async (userId: number) => {
  const user = await getUserById(userId);
  if (!user) {
    console.error(`User with ID ${userId} not found for hashing`);
    return "USER_NOT_FOUND";
  }

  const saltAndPepperedInput = `${userId}${user.username}${process.env.ANALYTICS_PEPPER}`;

  return createHash("sha256")
    .update(saltAndPepperedInput)
    .digest("hex")
    .substring(0, 16); // truncate to length of 16 chars
};

/**
 * The wrapper function that should be called for most analytic events in the app, where a user is
 * logged in.
 */
export const trackUserEvent = async (userId: number, event: EventName, data?: any) => {
  const userHash = await hashUserId(userId);

  // Include data on which user groups the user is a member of
  const userGroups = await sequelize.query(
    `SELECT ug.name
     FROM user_group_memberships ugm
     JOIN user_groups ug ON ugm.user_group_id = ug.iduser_groups
     WHERE ugm.user_id = :userId`,
    {
      replacements: { userId },
      type: QueryTypes.SELECT,
    }
  );

  const userGroupNames: string[] = userGroups
    ? userGroups.map((ug: { name: string }) => ug.name)
    : [];

  trackRawEvent(event, {
    ...data,
    distinct_id: userHash,
    user_groups: userGroupNames,
  });
};

/**
 * Return the land ownership geojson polygons within a given bounding box area
 *
 * @param sw_lng longitude of south-west corner
 * @param sw_lat latitude of south-west corner
 * @param ne_lng longitude of north-east corner
 * @param ne_lat latitude of north-east corner
 * @param type type of ownership to return, one of "all" (default), "localAuthority",
 * "churchOfEngland", "pending" or "unregistered".
 * @param acceptedOnly only matters if type is "pending". If true, only return pending polys marked
 * as accepted
 */
export const getPolygons = async (
  sw_lng: number,
  sw_lat: number,
  ne_lng: number,
  ne_lat: number,
  type?: string,
  acceptedOnly?: boolean
): Promise<any[]> => {
  const boundaryResponse = await axios.get(
    `${process.env.BOUNDARY_SERVICE_URL}/boundaries`,
    {
      params: {
        sw_lat,
        sw_lng,
        ne_lat,
        ne_lng,
        type,
        acceptedOnly,
        secret: process.env.BOUNDARY_SERVICE_SECRET,
      },
    }
  );

  return boundaryResponse.data;
};

/**
 * Perform a backsearch, to find all properties owned by a given owner.
 */
export const searchOwner = async (proprietorName: string) => {
  const boundaryResponse = await axios.get(
    `${process.env.BOUNDARY_SERVICE_URL}/search`,
    {
      params: {
        proprietorName,
        secret: process.env.BOUNDARY_SERVICE_SECRET,
      },
    }
  );

  return boundaryResponse.data ?? [];
};

export const findAllDataGroupContentForUser = async (userId: number) => {
  const userGroupMemberships = await UserGroupMembership.findAll({
    where: {
      user_id: { [Op.or]: [userId, -1] }, // Include public user groups
    },
  });

  const userGroups: any[] = [];

  for (const membership of userGroupMemberships) {
    const userGroup = await UserGroup.findOne({
      where: {
        iduser_groups: membership.user_group_id,
      },
      raw: true,
    });
    userGroup.access = membership.access;

    // Check that user group actually exists
    if (userGroup) {
      const existingUserGroup = userGroups.find(
        (group) => group.iduser_groups === userGroup.iduser_groups
      );

      // If the user group is already in the list, use the highest access level
      if (existingUserGroup) {
        existingUserGroup.access = Math.max(
          existingUserGroup.access,
          userGroup.access
        );
      } else {
        userGroups.push(userGroup);
      }
    }
  }

  const userGroupsAndData: any[] = [];

  for (const group of userGroups) {
    const dataGroupMemberships = await DataGroupMembership.findAll({
      where: {
        user_group_id: group.iduser_groups,
      },
    });

    const dataGroups: any[] = [];

    for (const membership of dataGroupMemberships) {
      const dataGroup = await DataGroup.findOne({
        where: {
          iddata_groups: membership.data_group_id,
        },
        raw: true,
      });
      // Check that data group actually exists
      if (dataGroup) {
        dataGroups.push(dataGroup);
      }
    }

    for (const dataGroup of dataGroups) {
      dataGroup.markers = await Marker.findAll({
        where: {
          data_group_id: dataGroup.iddata_groups,
        },
      });
      dataGroup.polygons = await Polygon.findAll({
        where: {
          data_group_id: dataGroup.iddata_groups,
        },
      });
      dataGroup.lines = await Line.findAll({
        where: {
          data_group_id: dataGroup.iddata_groups,
        },
      });
    }

    userGroupsAndData.push({
      name: group.name,
      id: group.iduser_groups,
      access: group.access,
      dataGroups,
    });
  }

  return userGroupsAndData;
};

export const hasWriteAccessToDataGroup = async (
  userId: number,
  dataGroupId: number
): Promise<boolean> => {
  const userGroupMemberships = await UserGroupMembership.findAll({
    where: {
      user_id: userId,
      access: UserGroupAccess.Readwrite,
    },
  });

  for (let membership of userGroupMemberships) {
    const dataGroupMembership = await DataGroupMembership.findOne({
      where: {
        user_group_id: membership.user_group_id,
        data_group_id: dataGroupId,
      },
    });

    if (dataGroupMembership) {
      return true;
    }
  }

  return false;
};

export const createUserFeedback = async (
  question_use_case: string,
  question_impact: string,
  question_who_benefits: string,
  question_improvements: string,
  user_id: number
) => {
  try {
    // Create a new user feedback entry in the database
    const userFeedback = await UserFeedback.create({
      question_use_case,
      question_impact,
      question_who_benefits,
      question_improvements,
      user_id,
      submission_date: new Date(), // Set the current date as the submission date
    });

    return userFeedback;
  } catch (error: any) {
    console.error(error.message);
    throw new Error("Failed to create user feedback");
  }
};

export const getAskForFeedback = async (userId: number): Promise<boolean> => {
  const user = await getUserById(userId);

  if (!user) {
    return false;
  }

  return user.ask_for_feedback === true;
};
