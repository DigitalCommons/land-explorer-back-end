'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.sequelize.query(
      `CREATE TABLE user_map (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        access int(11) NOT NULL,
        created_date datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        viewed bit(1) NOT NULL DEFAULT b'0',
        map_id bigint(20) DEFAULT NULL,
        user_id bigint(20) DEFAULT NULL,
        PRIMARY KEY (id),
        KEY FKivg3xmdvaflhdds6wh4k3xb2w (map_id),
        KEY FKfhiwt9igiru75odneq9p5fk27 (user_id),
        CONSTRAINT user_map_map FOREIGN KEY (map_id) REFERENCES map (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT user_map_user FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=latin1`
    );

  },
  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`DROP TABLE user_map`);
  }
};