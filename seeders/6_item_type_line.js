'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const polygonTypeExists = await queryInterface.rawSelect('item_types', {
            where: {
                iditem_types: 2
            }
        }, ['name']);

        if (polygonTypeExists)
            return Promise.resolve();

        return queryInterface.bulkInsert('item_types', [{
            iditem_types: 2,
            name: "line",
            description: "A line on the map, with a name and sequence of vertices joined by straight edges.",
            source: "LX_DB"
        }]);
    },

    down: (queryInterface, Sequelize) => {
        return queryInterface.bulkDelete('item_types', { iditem_types: 2 }, {});
    }

};
