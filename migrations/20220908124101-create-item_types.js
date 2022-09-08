'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {

        await queryInterface.sequelize.query(
            `CREATE TABLE item_types (
            iditem_types INT NOT NULL,
            name varchar(255) NOT NULL,
            description_id varchar(255) NOT NULL,
            source varchar(255) NOT NULL,
            PRIMARY KEY (iditem_types)
            ) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=latin1`
        );
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`DROP TABLE item_types`);
    }
};