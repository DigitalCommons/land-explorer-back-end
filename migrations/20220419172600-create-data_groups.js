'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {

        await queryInterface.sequelize.query(
            `CREATE TABLE data_groups (
        iddata_groups INT NOT NULL,
        title VARCHAR(45) NOT NULL,
        PRIMARY KEY (iddata_groups)
        ) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=latin1`
        );

    },
    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`DROP TABLE pending_user_map`);
    }
};