'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.sequelize.query(
      `CREATE TABLE pending_user_map (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        map_id bigint(20) DEFAULT NULL,
        access int(11) NOT NULL,
        email_address varchar(255) NOT NULL,
        created_date datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY FKi8n27mkvary26fkr406d9p8yl (map_id),
        CONSTRAINT pending_user_map_map FOREIGN KEY (map_id) REFERENCES map (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=latin1`
    );

  },
  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`DROP TABLE pending_user_map`);
  }
};