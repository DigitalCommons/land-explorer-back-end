'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(
            `ALTER TABLE polygons 
            ADD description LONGTEXT NULL;`
        );
        await queryInterface.sequelize.query(
            `ALTER TABLE linestrings 
            ADD description LONGTEXT NULL;`
        );
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(
            `ALTER TABLE polygons 
            DROP description;`
        );
        await queryInterface.sequelize.query(
            `ALTER TABLE linestrings 
            DROP description;`
        );
    }
};