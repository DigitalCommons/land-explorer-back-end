"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE user
        DROP COLUMN analytics_consent,
        ADD analytics_consent_granted_at DATETIME DEFAULT NULL,
        ADD analytics_consent_revoked_at DATETIME DEFAULT NULL;`,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE user
        DROP COLUMN analytics_consent_granted_at,
        DROP COLUMN analytics_consent_revoked_at,
        ADD analytics_consent BOOLEAN DEFAULT NULL;`,
    );
  },
};
