'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {

        await queryInterface.sequelize.query(
            `ALTER TABLE map
            ADD is_snapshot BOOLEAN NULL;`
        );
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(
            `ALTER TABLE map 
            DROP is_snapshot;`
        );
    }
};