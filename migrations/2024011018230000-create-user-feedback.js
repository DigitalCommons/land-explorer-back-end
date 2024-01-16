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
      user_id bigint DEFAULT NULL,
      submission_date timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY user_id (user_id),
      CONSTRAINT user_feedback_user FOREIGN KEY (user_id) REFERENCES user (id) 
    ) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1`
    );
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("user_feedback");
  },
};
