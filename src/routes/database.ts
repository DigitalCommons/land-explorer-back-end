import { Request, ResponseToolkit, ResponseObject, ServerRoute } from "@hapi/hapi";
import { Validation } from '../validation';

const jwt = require("jsonwebtoken");
const query = require('../queries/query');
const Model = require('../queries/database');
const mailer = require('../queries/mails');
const helper = require('../queries/helpers');

type RegisterRequest = Request & {
    payload: {
        username: string;
        password: string;
        firstName: string;
        lastName: string;
    }
};

/**
 * Register new user using request data from API
 */
async function registerUser(request: RegisterRequest, h: ResponseToolkit): Promise<ResponseObject> {
    const originDomain = `https://${request.info.host}`;

    let validation = new Validation();
    await validation.validateUserRegister(request.payload);

    if (validation.fail()) {
        return h.response(validation.errors).code(400);
    }

    // // create user on database
    let user = await query.registerUser(request.payload);

    //migrate user map from guest account
    await query.migrateGuestUserMap(user);

    // sent register email
    console.log(request.payload)
    mailer.sendRegisterEmail(request.payload.username, request.payload.firstName, originDomain)

    // return h.response(user);
    return h.response(user);
}

type LoginRequest = Request & {
    payload: {
        username: string;
        password: string;
    }
};

/**
 * Handle user login using request data from API
 */
async function loginUser(request: LoginRequest, h: ResponseToolkit): Promise<ResponseObject> {
    console.log("login user");

    try {
        const { username, password } = request.payload;
        const result = await query.checkAndReturnUser(username, password);

        if (result) {
            const expiry_day: number = parseInt(process.env.TOKEN_EXPIRY_DAYS || '10');

            // Create token
            const token = jwt.sign(
                {
                    user_id: result.id,
                    username: result.username,
                    council_id: result.council_id,
                    is_super_user: (result.is_super_user && result.is_super_user[0] == '1') ? 1 : 0,
                    enabled: (result.enabled && result.enabled[0] == '1') ? 1 : 0,
                    marketing: (result.enabled && result.enabled[0] == '1') ? 1 : 0,
                },
                process.env.TOKEN_KEY,
                {
                    expiresIn: expiry_day + "d",
                }
            );

            return h.response({
                access_token: token,
                token_type: "bearer",
                expires_in: expiry_day * 24 * 60 * 60
            });
        }

        return h.response({
            error: "invalid_credentials",
            error_description: "Username and password combination does not match our record."
        }).code(401);

    } catch (err: any) {
        console.log(err.message);
        return h.response("internal server error!").code(500);
    }
}

/**
 * Return the detail of authenticated user
 * @param request 
 * @param h 
 * @param d 
 * @returns 
 */
async function getAuthUserDetails(request: Request, h: ResponseToolkit, d: any): Promise<ResponseObject> {

    let user: typeof Model.User;

    try {
        user = await query.getUserById(request.auth.credentials.user_id);

        return h.response({
            username: user.username,
            firstName: user.first_name,
            lastName: user.last_name,
            marketing: user.marketing ? 1 : 0,
            organisation: user.organisation ?? "",
            organisationNumber: user.organisation_number ?? "",
            organisationType: user.organisation_type ?? "",
            organisationActivity: user.organisation_activity ?? "",
            address1: user.address1 ?? "",
            address2: user.address2 ?? "",
            city: user.city ?? "",
            postcode: user.postcode ?? "",
            phone: user.phone ?? "",
            council_id: user.council_id ?? 0,
            is_super_user: user.is_super_user ?? 0,
        });
    }
    catch (err: any) {
        console.log(err.message);

        return h.response("internal server error!").code(500);
    }

}

/**
 * Update the email of autheticated user
 * @param request 
 * @param h 
 * @param d 
 * @returns 
 */
async function changeEmail(request: Request, h: ResponseToolkit, d: any): Promise<ResponseObject> {

    let validation = new Validation();
    await validation.validateChangeEmail(request.payload);

    if (validation.fail()) {
        return h.response(validation.errors).code(400);
    }

    let payload: any = request.payload;

    try {
        await Model.User.update({ username: payload.username }, {
            where: {
                id: request.auth.credentials.user_id
            }
        });
    }
    catch (err: any) {
        console.log(err.message);
        return h.response("internal server error!").code(500);
    }

    return h.response().code(200);
}

/**
 * Change the user detail of the authenticated user
 */
async function changeUserDetail(request: Request, h: ResponseToolkit, d: any): Promise<ResponseObject> {

    let validation = new Validation();
    await validation.validateUserDetailUpdate(request.payload);

    if (validation.fail()) {
        return h.response(validation.errors).code(400);
    }

    let payload: any = request.payload;

    try {
        await Model.User.update(
            {
                first_name: payload.firstName,
                last_name: payload.lastName,
                address1: payload.address1,
                address2: payload.address2,
                postcode: payload.postcode,
                phone: payload.phone,
                organisation: payload.organisation,
                organisation_number: payload.organisationNumber,
                organisation_type: payload.organisationType,
                organisation_activity: payload.organisationActivity,
            },
            {
                where: {
                    id: request.auth.credentials.user_id
                }
            });
    }
    catch (err: any) {
        console.log(err.message);
        return h.response("internal server error!").code(500);
    }

    return h.response().code(200);
}

/**
 * Allow logged in user to change its password
 * 
 * @param request 
 * @param h 
 * @param d 
 * @returns 
 */
async function changePassword(request: Request, h: ResponseToolkit, d: any): Promise<ResponseObject> {
    let validation = new Validation();
    await validation.validateChangeEmail(request.payload);

    if (validation.fail()) {
        return h.response(validation.errors).code(400);
    }

    let payload: any = request.payload;

    try {
        await Model.User.update({ password: helper.hashPassword(payload.password) }, {
            where: {
                id: request.auth.credentials.user_id
            }
        });
    }
    catch (err: any) {
        console.log(err.message);
        return h.response("internal server error!").code(500);
    }

    return h.response().code(200);
}



/**
 * Allow user to request for password reset when they forget their password
 * 
 * @param request 
 * @param h 
 * @param d 
 * @returns 
 */
async function resetPassword(request: Request, h: ResponseToolkit, d: any): Promise<ResponseObject> {
    const originDomain = `https://${request.info.host}`;

    let validation = new Validation();
    await validation.validateResetPassword(request.payload);

    if (validation.fail()) {
        return h.response(validation.errors).code(400);
    }

    let payload: any = request.payload;

    try {
        let user = await Model.User.findOne({
            where: {
                username: payload.username
            }
        });

        if (!user) {
            // TODO: change this behaviour. We shouldn't spam an email that doesn't have an account...

            //If this email is not an user, notify them accordingly 
            mailer.resetPasswordNotFound(payload.username);
            return h.response().code(200);
        }

        // generate new random password
        const newPassword = helper.randomPassword();
        console.log('New user password is: ' + newPassword)

        // update user password
        await Model.User.update({ password: helper.hashPassword(newPassword) }, {
            where: {
                id: user.id
            }
        });

        // send email
        mailer.resetPassword(payload.username, user.first_name, newPassword, originDomain);

    } catch (err: any) {
        console.log(err.message);
        return h.response("internal server error!").code(500);
    }

    return h.response().code(200);
}

export const databaseRoutes: ServerRoute[] = [
    /** Public APIs */
    // Register a new account
    { method: "POST", path: "/api/user/register", handler: registerUser, options: { auth: false } },
    // Request a password reset for an email address
    { method: "POST", path: "/api/user/password-reset", handler: resetPassword, options: { auth: false } },
    // Login user and retrieve a token
    { method: "POST", path: "/api/token", handler: loginUser, options: { auth: false } },

    /** Authenticated users only */
    // Return logged in user's details
    { method: "GET", path: "/api/user/details", handler: getAuthUserDetails },
    // Allow user to change their email address
    { method: "POST", path: "/api/user/email", handler: changeEmail, },
    // Allow user to change their details
    { method: "POST", path: "/api/user/details", handler: changeUserDetail, },
    // Allow logged in user to change their password
    { method: "POST", path: "/api/user/password", handler: changePassword, },

];
