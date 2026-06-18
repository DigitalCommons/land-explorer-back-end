"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE user
            ADD analytics_consent BOOLEAN DEFAULT NULL;`,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE user
             DROP COLUMN analytics_consent;`,
    );
  },
};
