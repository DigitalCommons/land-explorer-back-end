'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {

        await queryInterface.sequelize.query(
            `CREATE TABLE user_groups (
            iduser_groups INT NOT NULL,
            name VARCHAR(45) NOT NULL,
            PRIMARY KEY (iduser_groups))
        ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=latin1`
        );

    },
    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`DROP TABLE pending_user_map`);
    }
};