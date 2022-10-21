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

        const testMapId = await queryInterface.bulkInsert('map', [{
            name: "Test Map",
            data: `{ "map": { "zoom": [7.098862221873304], "lngLat": [-1.4231817045257742, 52.472531034277125], "searchMarker": null, "marker": [-0.2416815, 51.5285582], "gettingLocation": false, "currentLocation": null, "movingMethod": "flyTo", "name": "Test Map" }, "drawings": { "polygons": [], "activePolygon": null, "polygonCount": 1, "lineCount": 1, "loadingDrawings": false }, "markers": { "searchMarker": [-0.2416815, 51.5285582], "currentMarker": null, "id": 1, "markers": [] }, "mapLayers": { "landDataLayers": [], "myDataLayers": [] }, "version": "1.1", "name": "Test Map", "markersInDB": true }`,
            deleted: 0,
            created_date: new Date(),
            last_modified: new Date()
        }]);

        await queryInterface.bulkInsert('user_map', [{
            access: 1,
            viewed: 1,
            map_id: testMapId,
            user_id: testUserId,
            created_date: new Date(),
        }]);

        const testMarkerId = await queryInterface.bulkInsert('markers', [{
            name: "Marker on Map",
            description: "We've got it and you know it",
            data_group_id: -1,
            location: Sequelize.fn('ST_GeomFromText', 'POINT(52.9504416 -1.1536082)')
        }]);

        return queryInterface.bulkInsert('map_memberships', [{
            map_id: testMapId,
            item_type_id: 0,
            item_id: testMarkerId,
        }]);
    },

    down: (queryInterface, Sequelize) => {
        return queryInterface.bulkDelete('user', null, {});
    }

};