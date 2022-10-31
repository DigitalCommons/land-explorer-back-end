'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
    async up(queryInterface, Sequelize) {

        const markersWithoutUuids = await queryInterface.sequelize.query(`
            SELECT * FROM markers WHERE uuid ='';
        `)

        for (let marker of markersWithoutUuids[0]) {
            const newUuid = uuidv4();

            await queryInterface.sequelize.query(`
                UPDATE markers
                SET uuid = '${newUuid}'
                WHERE markers.idmarkers = ${marker.idmarkers};
            `);
        }
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`
            UPDATE markers
            SET uuid = '';
        `);
    }
};