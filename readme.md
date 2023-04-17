<img src="https://raw.githubusercontent.com/hapijs/assets/master/images/hapi.png" width="400px" />

# @hapi/hapi

#### The Simple, Secure Framework Developers Trust

Build powerful, scalable applications, with minimal overhead and full out-of-the-box functionality - your code, your way.

### Visit the [hapi.dev](https://hapi.dev) Developer Portal for tutorials, documentation, and support

## About

This application provides the back-end functionality for Land Explorer. It has 3 main feature:
 -  Basic user account management. Authentication, registration, user details, and basic role (admin/not-admin). 
 - Landex maps. Storing and access management of map data from front end.
 - Polygon database. Accessing external database to access INSPIRE dataset of property boundary polygons. 
 
 Note: The polygon database is on a separate server from the application because the old provider does not support large memory for the database. With the server migration, we may merge the two database.


## Requirement

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

## APIs

### Auth API

 - POST `api/user/register/` Allow user to register a new account
 - POST `token/` Allow user to login and retrieve a token
 - GET `api/user/details/` Return logged in user's details
 - POST `api/user/email/` Allow user to change its email address
 - POST `api/user/details/` Allow user to change their user details
 - POST `api/user/password/` Allow logged in user to change its password
 - POST `api/user/password-reset/` Allow user to request for password reset when they forget their password

### Map API

 - POST `api/user/map/save/` Allow user to create or update a map
 - POST `api/user/map/view/` Record the activity when a user has viewed a map
 - POST `api/user/map/share/sync/` A method to share access of a map to a list of email addresses
 - POST `api/user/map/delete/` Allow user to delete a map
 - GET `api/user/maps/` Return map data accessible to logged in user

### Land ownership API

 - GET `api/ownership/` Return the geojson polygons of land ownership within a given bounding box area 

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
