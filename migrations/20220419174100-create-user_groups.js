'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {

        await queryInterface.sequelize.query(
            `CREATE TABLE user_groups (
            iduser_groups INT NOT NULL AUTO_INCREMENT=0,
            name VARCHAR(45) NOT NULL,
            PRIMARY KEY (iduser_groups))
        ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=latin1`
        );

    },
    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`DROP TABLE user_groups`);
    }
};