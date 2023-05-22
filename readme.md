# Land Explorer Back End

This application provides the back-end functionality for Land Explorer. It has 4 main features:
 - Basic user account management: Authentication, registration, user details
 - Maps: Managing access to maps, creating/updating map data
 - Data groups: Creating/updating data group data
 - Polygons: Accessing external INSPIRE dataset of property boundary polygons
 
 Note: The polygon database is on a separate server from the application because the old provider does not support large memory for the database. With the server migration, we may merge the two database.


## Requirements

 - Nodejs
 - Nodemon
 - MySQL

## Installation

 - Run `npm install`
 - Copy `.env.example` and rename the copy to `.env`
 - Fill in the `.env` with database credential
 - Run migration `npx sequelize-cli db:migrate`
 - Run seeder `npx sequelize-cli db:seed:all`
 - Run `npm run dev:serve`
 - Access 0.0.0.0:4000

Note: current setup does not support polygon database.
With this migration and seed, running the api/ownership/ endpoint will error.

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

- General rafactor for best practices.
- Graceful exceptions handling.
- Use DB transactions.
- Persistent error log (notification would be nice too).
- Await is currently being used for all async calls. Things like email API doesnt have to be blocking. 
- API calls (e.g., email) should have a retry. Or even better, be a queued job that can be retried.
- Migration and seed for polygon database.
- Tests (unit, system, etc)
- Better typing (instead of "any" type).
- Reset password process should not be auto-generating and emailing plain text password to user. 
- Polygon database may be moved to the server as the application.
- Dont use both import* & require(*)
