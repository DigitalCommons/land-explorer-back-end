'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const polygonTypeExists = await queryInterface.rawSelect('item_types', {
            where: {
                iditem_types: 1
            }
        }, ['name']);

        if (polygonTypeExists)
            return Promise.resolve();

        return queryInterface.bulkInsert('item_types', [{
            iditem_types: 1,
            name: "polygon",
            description: "A polygon on the map, with a name and finite number of vertices.",
            source: "LX_DB"
        }]);
    },

    down: (queryInterface, Sequelize) => {
        return queryInterface.bulkDelete('item_types', { iditem_types: 1 }, {});
    }

};
