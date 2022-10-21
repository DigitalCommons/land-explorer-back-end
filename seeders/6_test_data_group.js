'use strict';

const { faker } = require('@faker-js/faker');
const enums = require('../lib/enums');
const bcrypt = require('bcrypt');

module.exports = {

    up: async (queryInterface, Sequelize) => {
        const testUserId = await queryInterface.rawSelect('user', {
            where: {
                username: "test-lx@digitalcommons.coop"
            }
        }, ['id']);

        const testDataGroupId = await queryInterface.bulkInsert('data_groups', [{
            title: "Beautiful Data"
        }]);

        await queryInterface.bulkInsert('markers', [{
            name: "Tight Marker",
            description: "This is where the niceness resides",
            data_group_id: testDataGroupId,
            location: Sequelize.fn('ST_GeomFromText', 'POINT(52.7036 -1.5111)')
        }])

        const testUserGroupId = await queryInterface.bulkInsert('user_groups', [{
            name: "Friends Club"
        }])

        await queryInterface.bulkInsert('data_group_memberships', [{
            data_group_id: testDataGroupId,
            user_group_id: testUserGroupId
        }])


        return queryInterface.bulkInsert('user_group_memberships', [{
            user_group_id: testUserGroupId,
            user_id: testUserId
        }]);
    },

    down: (queryInterface, Sequelize) => {
        return queryInterface.bulkDelete('user', null, {});
    }

};