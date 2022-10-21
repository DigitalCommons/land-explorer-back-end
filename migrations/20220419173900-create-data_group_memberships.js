'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {

        await queryInterface.sequelize.query(
            `CREATE TABLE data_group_memberships (
                iddata_group_memberships INT NOT NULL AUTO_INCREMENT,
                data_group_id INT NOT NULL,
                user_group_id INT NOT NULL,
                PRIMARY KEY (iddata_group_memberships)
            ) ENGINE=InnoDB DEFAULT CHARSET=latin1`
        );

    },
    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`DROP TABLE data_group_memberships`);
    }
};