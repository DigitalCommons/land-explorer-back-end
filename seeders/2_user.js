'use strict';

const { faker } = require('@faker-js/faker');
const enums = require('../lib/enums');
const bcrypt = require('bcrypt');

module.exports = {

  up: (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert('user', [{
      first_name: faker.name.firstName(),
      last_name: faker.name.lastName(),
      address1: faker.address.streetAddress(),
      address2: faker.address.secondaryAddress(),
      city: faker.address.city(),
      postcode: faker.address.zipCode(),
      phone: faker.phone.phoneNumber(),

      marketing: faker.datatype.boolean(),
      organisation: faker.company.companyName(),
      organisation_number: faker.internet.color(),
      organisation_activity: enums.OrganisationSubType.PowerNetwork,
      organisation_type: enums.OrganisationType.Commercial,
      council_id: 0,

      // username: faker.internet.email(),
      // password: faker.internet.password(),
      username: faker.internet.email(),
      password: bcrypt.hashSync("password", 10),
      access: 2,
      enabled: 1,
      is_super_user: 1,

      created_date: new Date(),
      last_modified: new Date()
    }]);
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('user', null, {});
  }

};