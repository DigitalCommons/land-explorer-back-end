'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {

        await queryInterface.sequelize.query(
            `CREATE TABLE user_group_memberships (
            iduser_group_memberships INT NOT NULL AUTO_INCREMENT=0,
            user_group_id INT NOT NULL,
            user_id INT NOT NULL,
            PRIMARY KEY (iduser_group_memberships)
            ) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=latin1`
        );

    },
    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`DROP TABLE user_group_memberships`);
    }
};