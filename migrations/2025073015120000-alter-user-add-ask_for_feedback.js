'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {

        await queryInterface.sequelize.query(
            `ALTER TABLE user
            ADD ask_for_feedback BOOLEAN DEFAULT '1';`
        );
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(
            `ALTER TABLE user 
            DROP ask_for_feedback;`
        );
    }
};
