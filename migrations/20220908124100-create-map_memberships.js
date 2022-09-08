'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {

        await queryInterface.sequelize.query(
            `CREATE TABLE map_memberships (
            idmap_memberships INT NOT NULL,
            map_id INT NOT NULL,
            item_type_id INT NOT NULL,
            item_id INT NOT NULL,
            PRIMARY KEY (idmap_memberships)
            ) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=latin1`
        );

    },
    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`DROP TABLE map_memberships`);
    }
};