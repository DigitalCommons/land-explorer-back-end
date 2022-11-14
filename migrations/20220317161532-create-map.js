'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.sequelize.query(
      `CREATE TABLE map (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        name varchar(255) NOT NULL,
        data text NOT NULL,
        deleted tinyint(4) NOT NULL DEFAULT '0',
        created_date datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_modified datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=latin1`
    );

  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('map');
  }
};