"use-strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `CREATE TABLE locked_maps (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            map_id bigint(20) NOT NULL,
            user_id bigint(20) NOT NULL,
            is_locked bit(1) NOT NULL DEFAULT b'0',
            locked_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            unlocked_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            PRIMARY KEY (id),
            CONSTRAINT locked_map_map FOREIGN KEY (map_id) REFERENCES map (id) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT locked_map_user FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=latin1`
    );
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("locked_maps");
  },
};
