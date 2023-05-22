'use strict';

const { faker } = require('@faker-js/faker');
const enums = require('../lib/enums');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

module.exports = {

    up: async (queryInterface, Sequelize) => {
        const testUserId = await queryInterface.rawSelect('user', {
            where: {
                username: "test-lx@digitalcommons.coop"
            }
        }, ['id']);

        //the data field doesn't contain the drawn objects, meaning seeding requires a save for the seeded map items to show up
        const testMapId = await queryInterface.bulkInsert('map', [{
            name: "Test Map",
            data: `{ "map": { "zoom": [7.098862221873304], "lngLat": [-1.4231817045257742, 52.472531034277125], "searchMarker": null, "marker": [-0.2416815, 51.5285582], "gettingLocation": false, "currentLocation": null, "movingMethod": "flyTo", "name": "Test Map" }, "drawings": { "polygons": [], "activePolygon": null, "polygonCount": 1, "lineCount": 1, "loadingDrawings": false }, "markers": { "searchMarker": [-0.2416815, 51.5285582], "currentMarker": null, "id": 1, "markers": [] }, "mapLayers": { "landDataLayers": [], "myDataLayers": [] }, "version": "1.1", "name": "Test Map" }`,
            deleted: 0,
            created_date: new Date(),
            last_modified: new Date()
        }]);

        await queryInterface.bulkInsert('user_map', [{
            access: 2,
            viewed: 1,
            map_id: testMapId,
            user_id: testUserId,
            created_date: new Date(),
        }]);

        const testMarkerId = await queryInterface.bulkInsert('markers', [{
            name: "Marker on Map",
            description: "We've got it and you know it",
            data_group_id: -1,
            location: Sequelize.fn('ST_GeomFromText', 'POINT(-1.1536082 52.9504416 )'),
            uuid: uuidv4()
        }]);

        const testPolygonId = await queryInterface.bulkInsert('polygons', [{
            name: "Easterly Triangle",
            data_group_id: -1,
            vertices: Sequelize.fn('ST_GeomFromText', 'POLYGON ((-1.18245402344655 52.9404533498706,-1.39119425782184 52.2732916867361,-0.017903242196468 52.3471773871291,-1.18245402344655 52.9404533498706))'),
            center: Sequelize.fn('ST_GeomFromText', 'POINT (-0.704548750009153 52.6068725183034)'),
            length: 271.82364653878864,
            area: 3388986134.6564507,
            uuid: uuidv4()
        }])

        const testLinestringId = await queryInterface.bulkInsert('linestrings', [{
            name: "Loverly Line",
            data_group_id: -1,
            vertices: Sequelize.fn('ST_GeomFromText', 'LINESTRING (-1.93503931837319 52.9315835048763,-2.36432184027967 52.196199256889,-1.81015713018192 51.7006878285793,-0.576945521792652 51.5116362532414,0.34406061611719 51.7683605691632,0.437722257260077 52.3347255546921)'),
            length: 374.380357353871,
            uuid: uuidv4()
        }]);

        return queryInterface.bulkInsert('map_memberships', [{
            map_id: testMapId,
            item_type_id: 0,
            item_id: testMarkerId,
        },
        {
            map_id: testMapId,
            item_type_id: 1,
            item_id: testPolygonId,
        },
        {
            map_id: testMapId,
            item_type_id: 2,
            item_id: testLinestringId,
        },
        ]);
    },

    down: (queryInterface, Sequelize) => {
        return queryInterface.bulkDelete('user', null, {});
    }

};
