"use strict";

const { faker } = require("@faker-js/faker");

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert("user_feedback", [
      {
        question_1: faker.lorem.paragraph(),
        question_2: faker.lorem.paragraph(),
        question_3: faker.lorem.paragraph(),
        question_4: faker.lorem.paragraph(),
        feedback_user_id: 1,
      },
    ]);
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete("user_feedback", null, {});
  },
};
