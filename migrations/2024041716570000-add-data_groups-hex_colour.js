"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE data_groups 
            ADD hex_colour VARCHAR(7) DEFAULT NULL;`
    );
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE data_groups 
            DROP hex_colour;`
    );
  },
};
