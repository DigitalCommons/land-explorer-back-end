const { faker } = require("@faker-js/faker");
const enums = require("../lib/enums");
const bcrypt = require("bcrypt");

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert("locked_maps", [
      {
        user_id: 1,
        map_id: 1,
        is_locked: 0,
        locked_at: new Date(),
        unlocked_at: new Date(),
      },
    ]);
  },
};
