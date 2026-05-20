"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE user
            ADD has_seen_user_guide BOOLEAN DEFAULT '0';`,
    );
    await queryInterface.sequelize.query(
      `UPDATE user SET has_seen_user_guide = 1;`,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE user 
            DROP has_seen_user_guide;`,
    );
  },
};
