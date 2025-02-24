'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    // Add show marker in polygon boolean for all data groups

    await queryInterface.sequelize.query(
      `ALTER TABLE data_groups 
            ADD show_marker_in_polys boolean DEFAULT 0;`
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE data_groups 
      DROP show_marker_in_polys;`
  );
  }
};
