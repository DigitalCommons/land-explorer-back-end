"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `CREATE TABLE data_groups (
                iddata_groups INT NOT NULL AUTO_INCREMENT,
                title VARCHAR(45) NOT NULL,
                hex_colour VARCHAR(7) DEFAULT NULL,
                PRIMARY KEY (iddata_groups)
            ) ENGINE=InnoDB DEFAULT CHARSET=latin1`
    );
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`DROP TABLE data_groups`);
  },
};
