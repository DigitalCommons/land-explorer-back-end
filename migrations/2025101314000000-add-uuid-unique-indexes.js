"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE markers
      ADD UNIQUE KEY markers_uuid_unique (uuid);
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE polygons
      ADD UNIQUE KEY polygons_uuid_unique (uuid);
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE linestrings
      ADD UNIQUE KEY linestrings_uuid_unique (uuid);
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE markers
      DROP INDEX markers_uuid_unique;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE polygons
      DROP INDEX polygons_uuid_unique;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE linestrings
      DROP INDEX linestrings_uuid_unique;
    `);
  },
};
