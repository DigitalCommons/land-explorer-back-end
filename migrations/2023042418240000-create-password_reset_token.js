'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.sequelize.query(
      `CREATE TABLE password_reset_token (
        idpassword_reset_token bigint(20) NOT NULL AUTO_INCREMENT,
        user_id bigint(20) NOT NULL,
        token VARCHAR(100) NOT NULL,
        expires bigint(20) NOT NULL,
        PRIMARY KEY (idpassword_reset_token),
        KEY FKknsgu89saen228sankowu8920 (user_id),
        CONSTRAINT password_reset_token_user FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=latin1`
    );

  },
  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`DROP TABLE password_reset_token`);
  }
};
