const { Sequelize, DataTypes, Model } = require('sequelize');

import dotenv from 'dotenv';

dotenv.config();

/**
 * CORE Database
 */
export const sequelize = new Sequelize(process.env.DATABASE_NAME, process.env.DATABASE_USER, process.env.DATABASE_PASSWORD ?? "", {
  host: process.env.DATABASE_HOST ?? 'localhost',
  dialect: 'mysql'
});

const UserModel = sequelize.define('User', {
  // Model attributes are defined here
  first_name: { type: DataTypes.STRING, allowNull: false },
  last_name: { type: DataTypes.STRING, allowNull: false },
  address1: DataTypes.STRING,
  address2: DataTypes.STRING,
  city: DataTypes.STRING,
  phone: DataTypes.STRING,
  postcode: DataTypes.STRING,

  marketing: DataTypes.BOOLEAN,
  organisation: DataTypes.STRING,
  organisation_activity: DataTypes.STRING,
  organisation_number: DataTypes.STRING,
  organisation_type: DataTypes.STRING,
  council_id: { type: DataTypes.INTEGER, allowNull: false },

  username: { type: DataTypes.STRING, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  access: DataTypes.INTEGER,                             // 1 = member, 2 = admin
  enabled: DataTypes.INTEGER,
  is_super_user: { type: DataTypes.BOOLEAN, allowNull: false },

  created_date: Sequelize.DATE,
  last_modified: Sequelize.DATE,

}, {
  tableName: 'user',
  createdAt: 'created_date',
  updatedAt: 'last_modified',
});

const MapModel = sequelize.define('Map', {
  name: { type: DataTypes.STRING, allowNull: false },
  data: { type: DataTypes.TEXT, allowNull: false },
  deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: 0 },
  created_date: Sequelize.DATE,
  last_modified: Sequelize.DATE,

}, {
  tableName: 'map',
  createdAt: 'created_date',
  updatedAt: 'last_modified',
});

const UserMapModel = sequelize.define('UserMap', {
  map_id: { type: DataTypes.BIGINT, references: { model: MapModel, key: 'id' } },
  user_id: { type: DataTypes.BIGINT, references: { model: UserModel, key: 'id' } },
  access: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  viewed: { type: DataTypes.TEXT, allowNull: false, defaultValue: 0 },
  created_date: Sequelize.DATE,
}, {
  tableName: 'user_map',
  createdAt: 'created_date',
  updatedAt: false,
});

const PendingUserMapModel = sequelize.define('PendingUserMap', {
  map_id: { type: DataTypes.BIGINT, references: { model: MapModel, key: 'id' } },
  access: { type: DataTypes.INTEGER, allowNull: false },
  email_address: { type: DataTypes.STRING, allowNull: false },
  created_date: Sequelize.DATE,
}, {
  tableName: 'pending_user_map',
  createdAt: 'created_date',
  updatedAt: false,
});

const DataGroupModel = sequelize.define('DataGroup', {
  iddata_groups: { type: DataTypes.BIGINT, allowNull: false, primaryKey: true },
  title: { type: DataTypes.STRING },
}, {
  tableName: 'data_groups',
  createdAt: false,
  updatedAt: false,
});

const MarkerModel = sequelize.define('Marker', {
  idmarkers: { type: DataTypes.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING },
  description: { type: DataTypes.STRING },
  data_group_id: { type: DataTypes.BIGINT, references: { model: DataGroupModel, key: 'iddata_groups' }, allowNull: false },
  location: { type: DataTypes.GEOMETRY('POINT'), allowNull: false },
  uuid: { type: DataTypes.STRING, allowNull: false }
}, {
  tableName: 'markers',
  createdAt: false,
  updatedAt: false,
});

const UserGroupModel = sequelize.define('UserGroup', {
  iduser_groups: { type: DataTypes.BIGINT, allowNull: false, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
}, {
  tableName: 'user_groups',
  createdAt: false,
  updatedAt: false,
});

const DataGroupMembershipModel = sequelize.define('DataGroupMembership', {
  iddata_group_memberships: { type: DataTypes.BIGINT, allowNull: false, primaryKey: true },
  data_group_id: { type: DataTypes.BIGINT, references: { model: DataGroupModel, key: 'iddata_groups' }, allowNull: false },
  user_group_id: { type: DataTypes.BIGINT, references: { model: UserGroupModel, key: 'iduser_groups' }, allowNull: false },
}, {
  tableName: 'data_group_memberships',
  createdAt: false,
  updatedAt: false,
});

const UserGroupMembershipModel = sequelize.define('UserGroupMembership', {
  iduser_group_memberships: { type: DataTypes.BIGINT, allowNull: false, primaryKey: true },
  user_id: { type: DataTypes.BIGINT, references: { model: UserModel, key: 'id' }, allowNull: false },
  user_group_id: { type: DataTypes.BIGINT, references: { model: UserGroupModel, key: 'iduser_groups' }, allowNull: false },
}, {
  tableName: 'user_group_memberships',
  createdAt: false,
  updatedAt: false,
});

//define the map membership and item type model

const ItemTypeModel = sequelize.define('ItemType', {
  iditem_types: { type: DataTypes.BIGINT, allowNull: false, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING, allowNull: false },
  source: { type: DataTypes.STRING, allowNull: false }
}, {
  tableName: 'item_types',
  createdAt: false,
  updatedAt: false,
})

const MapMembershipModel = sequelize.define('MapMembership', {
  idmap_memberships: { type: DataTypes.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
  map_id: { type: DataTypes.BIGINT, references: { model: MapModel, key: 'id' }, allowNull: false },
  item_type_id: { type: DataTypes.BIGINT, references: { model: ItemTypeModel, key: 'iduser_groups' }, allowNull: false },
  item_id: { type: DataTypes.BIGINT, allowNull: false },
}, {
  tableName: 'map_memberships',
  createdAt: false,
  updatedAt: false,
});

UserModel.hasMany(UserMapModel, { foreignKey: { name: 'user_id' } });
MapModel.hasMany(UserMapModel, { foreignKey: { name: 'map_id' } });

UserMapModel.belongsTo(UserModel, { foreignKey: { name: 'user_id' } });
UserMapModel.belongsTo(MapModel, { foreignKey: { name: 'map_id' } });

MapModel.hasMany(PendingUserMapModel, { foreignKey: { name: 'map_id' } });

export const User = UserModel;
export const Map = MapModel;
export const UserMap = UserMapModel;
export const PendingUserMap = PendingUserMapModel;
export const Marker = MarkerModel;
export const DataGroup = DataGroupModel;
export const DataGroupMembership = DataGroupMembershipModel;
export const UserGroup = UserGroupModel;
export const UserGroupMembership = UserGroupMembershipModel;
export const MapMembership = MapMembershipModel;
export const ItemType = ItemTypeModel;

/* The access values in the UserMap table */
export enum UserMapAccess {
  Readonly = 1,
  Readwrite = 2,
}

/* Possible values of the iditem_types column in the ItemType table */
export enum ItemTypeId {
  Marker = 0,
}

/**
 * Polygon Database
 */
export const polygonDbSequelize = new Sequelize(
  process.env.POLYGON_DATABASE_NAME,
  process.env.POLYGON_DATABASE_USER,
  process.env.POLYGON_DATABASE_PASSWORD ?? "",
  {
    host: process.env.POLYGON_DATABASE_HOST ?? 'localhost',
    dialect: 'mysql'
  }
);