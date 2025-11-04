"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = ["markers", "polygons", "linestrings"];

    for (const table of tables) {
      await queryInterface.sequelize.query(`
        UPDATE ${table}
        SET uuid = UUID()
        WHERE uuid IS NULL OR uuid = '';
      `);

      // Replace duplicate UUIDs with new ones
      await queryInterface.sequelize.query(`
        UPDATE ${table} t1
        JOIN ${table} t2
          ON t1.uuid = t2.uuid
         AND t1.id > t2.id
        SET t1.uuid = UUID();
      `);
    }

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
