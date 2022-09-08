'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const markerTypeExists = await queryInterface.rawSelect('item_types', {
            where: {
                iditem_types: 0
            }
        }, ['name']);

        if (markerTypeExists)
            return Promise.resolve();

        return queryInterface.bulkInsert('item_types', [{
            iditem_types: 0,
            name: "marker",
            description: "A single point on the map, with a title and description.",
            source: "LX_DB"
        }]);
    },

    down: (queryInterface, Sequelize) => {
        return queryInterface.bulkDelete('item_types', null, {});
    }

};