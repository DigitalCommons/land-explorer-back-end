"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `CREATE TABLE user_feedback (
      id bigint NOT NULL AUTO_INCREMENT,
      question_1 text,
      question_2 text,
      question_3 text,
      question_4 text,
      feedback_user_id bigint DEFAULT NULL,
      submission_date timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY feedback_user_id (feedback_user_id),
      CONSTRAINT user_feedback_ibfk_1 FOREIGN KEY (feedback_user_id) REFERENCES user (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=latin1`
    );
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("user_feedback");
  },
};
