"use strict";

const { faker } = require("@faker-js/faker");

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert("user_feedback", [
      {
        question_use_case: faker.lorem.paragraph(),
        question_impact: faker.lorem.paragraph(),
        question_who_benefits: faker.lorem.paragraph(),
        question_improvements: faker.lorem.paragraph(),
        feedback_user_id: 1,
      },
    ]);
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete("user_feedback", null, {});
  },
};
