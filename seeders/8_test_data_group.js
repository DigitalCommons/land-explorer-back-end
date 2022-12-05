'use strict';

const { v4: uuidv4 } = require('uuid');

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
            location: Sequelize.fn('ST_GeomFromText', 'POINT(-1.5111 52.7036 )'),
            uuid: uuidv4()
        }]);

        await queryInterface.bulkInsert('markers', [{
            name: "Tight Marker 2",
            description: "This is where the niceness resides 2",
            data_group_id: testDataGroupId,
            location: Sequelize.fn('ST_GeomFromText', 'POINT(-1.6 52.6036 )'),
            uuid: uuidv4()
        }]);

        await queryInterface.bulkInsert('polygons', [{
            name: "Cool Triangle",
            description: "Looks a bit like a dorito, but a dorito that size would be a disaster",
            data_group_id: testDataGroupId,
            vertices: Sequelize.fn('ST_GeomFromText', 'POLYGON ((-1.18245402344655 52.9404533498706,-1.39119425782184 52.2732916867361,-0.017903242196468 52.3471773871291,-1.18245402344655 52.9404533498706))'),
            center: Sequelize.fn('ST_GeomFromText', 'POINT (-0.704548750009153 52.6068725183034)'),
            length: 271.82364653878864,
            area: 3388986134.6564507,
            uuid: uuidv4()
        }])

        await queryInterface.bulkInsert('linestrings', [{
            name: "Brilliant Line",
            description: "Dorito impact zone",
            data_group_id: testDataGroupId,
            vertices: Sequelize.fn('ST_GeomFromText', 'LINESTRING (-1.93503931837319 52.9315835048763,-2.36432184027967 52.196199256889,-1.81015713018192 51.7006878285793,-0.576945521792652 51.5116362532414,0.34406061611719 51.7683605691632,0.437722257260077 52.3347255546921)'),
            length: 374.380357353871,
            uuid: uuidv4()
        }]);

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
