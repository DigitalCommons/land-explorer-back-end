'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {

        await queryInterface.sequelize.query(
            `CREATE TABLE markers (
              idmarkers INT NOT NULL AUTO_INCREMENT=0,
              name VARCHAR(45) NULL,
              description LONGTEXT NULL,
              data_group_id INT NOT NULL,
              location POINT NOT NULL,
              PRIMARY KEY (idmarkers)
            ) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=latin1`
        );

    },
    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`DROP TABLE markers`);
    }
};

