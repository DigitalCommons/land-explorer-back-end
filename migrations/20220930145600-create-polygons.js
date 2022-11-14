'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {

        await queryInterface.sequelize.query(
            `CREATE TABLE polygons (
                idpolygons INT NOT NULL AUTO_INCREMENT,
                name VARCHAR(45) NULL,
                data_group_id INT NOT NULL,
                vertices POLYGON NOT NULL,
                center POINT NOT NULL,
                length DOUBLE PRECISION NOT NULL,
                area DOUBLE PRECISION NOT NULL,
                uuid VARCHAR(45) NOT NULL,
                PRIMARY KEY (idpolygons)
            ) ENGINE=InnoDB DEFAULT CHARSET=latin1`
        );

    },
    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`DROP TABLE polygons`);
    }
};
