"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // set access to ReadWrite for all current user_group_memberships
    await queryInterface.sequelize.query(
      `ALTER TABLE user_group_memberships 
            ADD access int(11) DEFAULT 3;`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE user_group_memberships
            MODIFY COLUMN access int(11) NOT NULL;`
    );
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE user_group_memberships 
            DROP access;`
    );
  },
};
