'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {

        await queryInterface.sequelize.query(
            // Call the table 'linestrings' since 'lines' is a reserved MySql word
            `CREATE TABLE linestrings (
                idlinestrings INT NOT NULL AUTO_INCREMENT,
                name VARCHAR(45) NULL,
                data_group_id INT NOT NULL,
                vertices LINESTRING NOT NULL,
                length DOUBLE PRECISION NOT NULL,
                uuid VARCHAR(45) NOT NULL,
                PRIMARY KEY (idlinestrings)
            ) ENGINE=InnoDB DEFAULT CHARSET=latin1`
        );

    },
    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`DROP TABLE linestrings`);
    }
};
