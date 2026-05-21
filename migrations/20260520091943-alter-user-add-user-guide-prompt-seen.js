"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE user
            ADD user_guide_prompt_seen BOOLEAN DEFAULT '0';`,
    );
    await queryInterface.sequelize.query(
      `UPDATE user SET user_guide_prompt_seen = 1;`,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE user 
            DROP user_guide_prompt_seen;`,
    );
  },
};
