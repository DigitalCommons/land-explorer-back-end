'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.sequelize.query(
        `CREATE TABLE user (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        first_name varchar(255) NOT NULL,
        last_name varchar(255) NOT NULL,
        address1 varchar(255) DEFAULT NULL,
        address2 varchar(255) DEFAULT NULL,
        city varchar(255) DEFAULT NULL,
        phone varchar(255) DEFAULT NULL,
        postcode varchar(255) DEFAULT NULL,

        marketing bit(1) DEFAULT NULL,
        organisation varchar(255) DEFAULT NULL,
        organisation_activity varchar(255) DEFAULT NULL,
        organisation_number varchar(255) DEFAULT NULL,
        organisation_type varchar(255) DEFAULT NULL,
        council_id int(11) NOT NULL DEFAULT '0',

        username varchar(255) NOT NULL,
        password varchar(255) NOT NULL,
        access int(11) DEFAULT NULL,
        enabled bit(1) DEFAULT NULL,
        is_super_user tinyint(4) NOT NULL DEFAULT '0',
        last_login datetime DEFAULT NULL,
        login_failure_count int(11) DEFAULT NULL,
        
        created_date datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_modified datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,

        PRIMARY KEY (id),
        UNIQUE KEY UK_sb8bbouer5wak8vyiiy4pf2bx (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=latin1`
    );

  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('user');
  }
};