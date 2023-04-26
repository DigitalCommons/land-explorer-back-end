import { Request, ResponseToolkit, ResponseObject, ServerRoute } from "@hapi/hapi";
import jwt from 'jsonwebtoken';
import { Validation } from '../validation';
import * as mailer from '../queries/mails';
import { createUser, migrateGuestUserMap, checkAndReturnUser, getUserById } from '../queries/query';
import { User, PasswordResetToken } from "../queries/database";
import { hashPassword, generateRandomToken } from "../queries/helper";

const RESET_PASSWORD_EXPIRY_HOURS = 24;

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

    // create user on database
    let user = await createUser(request.payload);

    //migrate user map from guest account
    await migrateGuestUserMap(user);

    // sent register email
    console.log(request.payload)
    mailer.sendRegisterEmail(request.payload.username, request.payload.firstName, originDomain)

    // return h.response(user);
    return h.response(user);
}

type LoginRequest = Request & {
    payload: {
        username: string;
        password?: string;
        reset_token?: string;
    }
};

/**
 * Handle user login using request data from API
 */
async function loginUser(request: LoginRequest, h: ResponseToolkit): Promise<ResponseObject> {
    console.log("login user");

    try {
        const { username, password, reset_token } = request.payload;
        const result = await checkAndReturnUser(username, password, reset_token);

        if (result) {
            const expiry_day: number = parseInt(process.env.TOKEN_EXPIRY_DAYS || '10');

            const secretKey: string = process.env.TOKEN_KEY || '';

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
                secretKey,
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

type UserDetailsRequest = Request & {
    auth: {
        credentials: {
            user_id: number;
        }
    }
};

/**
 * Return the details of authenticated user
 */
async function getAuthUserDetails(request: UserDetailsRequest, h: ResponseToolkit, d: any): Promise<ResponseObject> {

    let user: typeof User;

    try {
        user = await getUserById(request.auth.credentials.user_id);

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
 */
async function changeEmail(request: Request, h: ResponseToolkit, d: any): Promise<ResponseObject> {
    let validation = new Validation();
    await validation.validateChangeEmail(request.payload);

    if (validation.fail()) {
        return h.response(validation.errors).code(400);
    }

    let payload: any = request.payload;

    try {
        await User.update({ username: payload.username }, {
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
        await User.update(
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

type ChangePasswordRequest = Request & {
    payload: {
        password: string
    }
};

/**
 * Allow logged in user to change their password
 */
async function changePassword(request: ChangePasswordRequest, h: ResponseToolkit, d: any): Promise<ResponseObject> {
    const { password } = request.payload;

    let validation = new Validation();
    await validation.validateChangePassword(request.payload);

    if (validation.fail()) {
        return h.response(validation.errors).code(400);
    }

    try {
        await User.update({ password: hashPassword(password) }, {
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

type ResetPasswordRequest = Request & {
    payload: {
        username: string
    }
};

/**
 * Allow user to request a password reset link when they forget their password
 */
async function resetPassword(request: ResetPasswordRequest, h: ResponseToolkit, d: any): Promise<ResponseObject> {
    const { username } = request.payload;

    try {
        let user = await User.findOne({
            where: {
                username: username
            }
        });

        if (!user) {
            // To avoid username guesses by a hacker, just return 200 OK
            return h.response().code(200);
        }

        // Generate a one-time token and store this in the database.
        // Before this, remove any existing tokens for this user.
        await PasswordResetToken.destroy({
            where: { user_id: user.id }
        });

        const passwordResetToken = await generateRandomToken();

        await PasswordResetToken.create({
            user_id: user.id,
            token: passwordResetToken,
            expires: Date.now() + RESET_PASSWORD_EXPIRY_HOURS * 3600 * 1000 // UNIX timestamp in ms
        });

        // Use the token to build the reset link
        const passwordResetLink = `https://${request.info.host}/auth?email=${encodeURIComponent(username)}&reset_token=${passwordResetToken}`;

        // Send email
        mailer.sendResetPasswordEmail(username, user.first_name, passwordResetLink, RESET_PASSWORD_EXPIRY_HOURS);

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
    { method: "POST", path: "/api/user/email", handler: changeEmail },
    // Allow user to change their details
    { method: "POST", path: "/api/user/details", handler: changeUserDetail },
    // Allow logged in user to change their password
    { method: "POST", path: "/api/user/password", handler: changePassword },

];
