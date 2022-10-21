'use strict';

const { faker } = require('@faker-js/faker');
const enums = require('../lib/enums');
const bcrypt = require('bcrypt');

module.exports = {

    up: async (queryInterface, Sequelize) => {
        const testUserExists = await queryInterface.rawSelect('user', {
            where: {
                username: "test-lx@digitalcommons.coop"
            }
        }, ['id']);

        if (testUserExists)
            return Promise.resolve();

        return queryInterface.bulkInsert('user', [{
            first_name: "Testing",
            last_name: "LX User",
            address1: faker.address.streetAddress(),
            address2: faker.address.secondaryAddress(),
            city: faker.address.city(),
            postcode: faker.address.zipCode(),
            phone: faker.phone.phoneNumber(),

            marketing: true,
            organisation: faker.company.companyName(),
            organisation_number: faker.internet.color(),
            organisation_activity: enums.OrganisationSubType.PowerNetwork,
            organisation_type: enums.OrganisationType.Commercial,
            council_id: 0,
            username: "test-lx@digitalcommons.coop",
            password: bcrypt.hashSync("testingtesting123", 10),
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