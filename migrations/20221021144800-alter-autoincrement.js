'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {

        await queryInterface.sequelize.query(
            `ALTER TABLE data_group_memberships 
            CHANGE COLUMN iddata_group_memberships iddata_group_memberships INT NOT NULL AUTO_INCREMENT ;`
        );

        await queryInterface.sequelize.query(
            `ALTER TABLE user_groups 
            CHANGE COLUMN iduser_groups iduser_groups INT NOT NULL AUTO_INCREMENT ;`
        );

        await queryInterface.sequelize.query(
            `ALTER TABLE user_group_memberships 
            CHANGE COLUMN iduser_group_memberships iduser_group_memberships INT NOT NULL AUTO_INCREMENT ;`
        );
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(
            `ALTER TABLE data_group_memberships 
            CHANGE COLUMN iddata_group_memberships iddata_group_memberships INT NOT NULL ;`
        );

        await queryInterface.sequelize.query(
            `ALTER TABLE user_groups 
            CHANGE COLUMN iduser_groups iduser_groups INT NOT NULL ;`
        );

        await queryInterface.sequelize.query(
            `ALTER TABLE user_group_memberships 
            CHANGE COLUMN iduser_group_memberships iduser_group_memberships INT NOT NULL  ;`
        );
    }
};