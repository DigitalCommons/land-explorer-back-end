'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {

        await queryInterface.sequelize.query(
            `ALTER TABLE markers 
            ADD uuid VARCHAR(45) NOT NULL;`
        );
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(
            `ALTER TABLE markers 
            DROP uuid;`
        );
    }
};