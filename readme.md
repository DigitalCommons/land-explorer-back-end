# Land Explorer Back End

This application provides the back-end functionality for Land Explorer. It has 4 main features:
 - Basic user account management: Authentication, registration, user details
 - Maps: Managing access to maps, creating/updating map data
 - Data groups: Creating/updating data group data
 - Ownership: Accessing company ownerhsip and INSPIRE property boundary polygons data. This data is
    served by our own separate app, the Property Boundaries Service, and this back-end application
    mostly just forwards the data to the Land Explorer client.


## Requirements

 - Nodejs
 - MySQL

## Installation

 - Run `npm install`
 - Copy `.env.example` and rename the copy to `.env`
 - If in development, create a MySql schema for testing
 - Fill in the `.env` with database credentials
 - Run migration `npx sequelize-cli db:migrate`
 - Run seeder `npx sequelize-cli db:seed:all`
 - Run `npm run dev:serve`
 - Access 0.0.0.0:4000

## Dev command cheat sheets

 - Reset migration `npx sequelize-cli db:seed:undo:all && npx sequelize-cli db:migrate:undo:all`

## Unit tests

 - Run `npm test` to run all UTs
 - We use the [Mocha](https://mochajs.org/) testing framework for our tests, with [Chai](https://www.chaijs.com/) for assertions and [Sinon](https://sinonjs.org/) for mocks, spies, stubs, etc.

### Writing a unit test
 - See the [Testing wiki](https://github.com/DigitalCommons/land-explorer-front-end/wiki/Testing#unit-tests) for general advice on writing UTs
 - Add UTs to a `.test.ts` file in the same directory as the code you are testing.
 - The files `routes/database.test.ts` and `routes/maps.test.ts` contain good examples of UTs
 - In VS Code, install the extensions:
   - _ES6 Mocha Snippets_ to make writing test boilerplate code faster
   - _Mocha Test Explorer_ to run individual tests from sidebar. Note, this extension sometimes doesn't catch exceptions that occur between tests, so you should also occasionally run `npm test` manually.

## APIs

See the full list of APIs and their purpose by looking at the bottom of each file in the `src/routes/` directory.

## TODOs

- Better typing (instead of "any" type).
- Dont use both import* & require(*)
