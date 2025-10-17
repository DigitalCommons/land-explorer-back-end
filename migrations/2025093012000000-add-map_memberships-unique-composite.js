"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove duplicates keeping the lowest id
    await queryInterface.sequelize.query(`
      DELETE t1 FROM map_memberships t1
      INNER JOIN map_memberships t2
        ON t1.map_id = t2.map_id
       AND t1.item_type_id = t2.item_type_id
       AND t1.item_id = t2.item_id
       AND t1.idmap_memberships > t2.idmap_memberships;
    `);

    // Add unique composite index
    await queryInterface.sequelize.query(`
      ALTER TABLE map_memberships
      ADD UNIQUE KEY map_membership_unique (map_id, item_type_id, item_id);
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE map_memberships
      DROP INDEX map_membership_unique;
    `);
  },
};
