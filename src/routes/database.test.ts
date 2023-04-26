// Chai provides assertions (e.g. expect, assert)
import { expect } from "chai";
// Sinon provides mocks, spies, stubs, etc. We use them to replace and control the behaviour of code
// that is external to our test unit, or to verify how out test unit interfaces with external code.
import { assert, createSandbox, fake, SinonSpy } from "sinon"
import { Server } from "@hapi/hapi";
import { init } from "../server"

// Dependencies to be stubbed https://sinonjs.org/how-to/stub-dependency/
const query = require("../queries/query");
const mailer = require("../queries/mails");
const helper = require("../queries/helper");
const Model = require("../queries/database");
const jwt = require("jsonwebtoken");

// We plug all our fakes, spies, etc into the system under test using a sandbox. This makes it
// easier to clean them up after each test. 
const sandbox = createSandbox();

let server: Server;

// Describe the feature that we're testing
describe("POST /api/token", () => {
    const testUser = {
        id: 123,
        username: "douglas.quaid@yahoomail.com",
        council_id: 0,
        is_super_user: 0,
        enabled: 1,
        marketing: 1,
    }

    // This runs before each 'it' testcase
    beforeEach(async () => {
        server = await init();
    });

    // Cleanup that run after each 'it' testcase
    afterEach(async () => {
        await server.stop();

        // Restore all fakes that were created https://sinonjs.org/releases/latest/sandbox/
        sandbox.restore();
    });

    // Split into contexts for each scenario that could happen when using the feature
    context("Login found", () => {

        // This also runs before each 'it', after the 'beforeEach' on the level above
        beforeEach(() => {
            // Replace the query.checkAndReturnUser method with a fake that we can control to return
            // our test value. We do this because we don't want the behaviour of the query module to
            // affect this unit test.
            // https://sinonjs.org/releases/latest/sandbox/#sandboxreplaceobject-property-replacement
            sandbox.replace(query, "checkAndReturnUser", fake.resolves(testUser));
        });

        // A testcase for an individual behaviour
        it("returns status 200", async () => {
            const res = await server.inject({
                method: "POST",
                url: "/api/token",
                payload: {
                    username: "douglas.quaid@yahoomail.com",
                    password: "testingtesting123"
                }
            });

            // The test passes or fails on this line
            expect(res.statusCode).to.equal(200);
        });

        it("returns token which expires in 365 days", async () => {
            const res = await server.inject({
                method: "POST",
                url: "/api/token",
                payload: {
                    username: "douglas.quaid@yahoomail.com",
                    password: "testingtesting123"
                }
            });

            const expectedExpiresIn = 365 * 24 * 60 * 60;
            expect(res.result).to.have.property('expires_in', expectedExpiresIn);
        });
    });

    context("Login not found", () => {
        beforeEach(() => {
            sandbox.replace(query, "checkAndReturnUser", fake.resolves(false));
        });

        it("returns status 401", async () => {
            const res = await server.inject({
                method: "POST",
                url: "/api/token",
                payload: {
                    username: "douglas.quaid@yahoomail.com",
                    password: "bad-password"
                }
            });

            expect(res.statusCode).to.equal(401);
        });
    });

    context("JWT signing throws error", () => {
        beforeEach(() => {
            sandbox.replace(query, "checkAndReturnUser", fake.resolves(testUser));
            // Fake jwt.sign() so that it throws an error
            sandbox.replace(jwt, "sign", fake.throws("signing error"));
        });

        it("returns status 500", async () => {
            const res = await server.inject({
                method: "POST",
                url: "/api/token",
                payload: {
                    username: "douglas.quaid@yahoomail.com",
                    password: "testingtesting123"
                }
            });

            expect(res.statusCode).to.equal(500);
        });
    });

    context("Login with password reset token", () => {
        const testRandomToken = 'RaNDomTokEn123'

        beforeEach(() => {
            sandbox.replace(query, "checkAndReturnUser", fake.resolves(testUser));
        });

        it("returns status 200", async () => {
            const res = await server.inject({
                method: "POST",
                url: "/api/token",
                payload: {
                    username: "douglas.quaid@yahoomail.com",
                    reset_token: testRandomToken
                }
            });

            expect(res.statusCode).to.equal(200);
        });

        it("returns token which expires in 365 days", async () => {
            const res = await server.inject({
                method: "POST",
                url: "/api/token",
                payload: {
                    username: "douglas.quaid@yahoomail.com",
                    reset_token: testRandomToken
                }
            });

            const expectedExpiresIn = 365 * 24 * 60 * 60;
            expect(res.result).to.have.property('expires_in', expectedExpiresIn);
        });
    });
});

describe("POST /api/user/password-reset", () => {
    const testUserId = 123;
    const testEmail = 'douglas.quaid@yahoomail.com';
    const testFirstName = 'Douglas';
    const testRandomToken = 'RaNDomTokEn123'

    let fakePasswordResetTokenCreate: SinonSpy;
    let fakePasswordResetTokenDestroy: SinonSpy;
    let fakeSendResetPasswordEmail: SinonSpy;

    beforeEach(async () => {
        server = await init();

        // Replace these functions with fakes, so we can assert on whether they are called and the
        // arguments that are passed to them
        fakeSendResetPasswordEmail = sandbox.replace(mailer, "sendResetPasswordEmail", fake());
        fakePasswordResetTokenCreate = sandbox.replace(Model.PasswordResetToken, "create", fake());
        fakePasswordResetTokenDestroy = sandbox.replace(Model.PasswordResetToken, "destroy", fake());
        sandbox.replace(helper, "generateRandomToken", fake.resolves(testRandomToken));
    });

    afterEach(async () => {
        await server.stop();
        sandbox.restore();
    });

    context("User exists", () => {
        beforeEach(() => {
            // fake User.findOne to return our test user
            sandbox.replace(Model.User, "findOne", fake.resolves({
                id: testUserId,
                username: testEmail,
                first_name: testFirstName
            }));
        });

        it("sends a password reset email", async () => {
            await server.inject({
                method: "POST",
                url: "/api/user/password-reset",
                payload: {
                    username: testEmail
                }
            });

            // Verify that our spy called the 'sendResetPasswordEmail' function once
            assert.calledOnce(fakeSendResetPasswordEmail);
        });

        it("deletes all password reset tokens that were previously given to the user", async () => {
            await server.inject({
                method: "POST",
                url: "/api/user/password-reset",
                payload: {
                    username: testEmail
                }
            });

            // Verify that our spy called the 'destroy' function once with the specified arguments
            assert.calledOnceWithMatch(fakePasswordResetTokenDestroy, {
                where: {
                    user_id: testUserId
                }
            });
        });

        it("stores new password reset token with 24 hours expiry", async () => {
            // Sets the UNIX epoch to 0, and we can tick the clock exactly how much we want, so the
            // test is reproducable https://sinonjs.org/releases/latest/fake-timers/
            sandbox.useFakeTimers();

            // We don't use 'await' here, since we're faking the clock, so it would hang
            server.inject({
                method: "POST",
                url: "/api/user/password-reset",
                payload: {
                    username: testEmail
                }
            });

            // Now resolve all the promises
            await sandbox.clock.runAllAsync();

            assert.calledOnceWithMatch(fakePasswordResetTokenCreate, {
                user_id: testUserId,
                token: testRandomToken,
                expires: 24 * 3600 * 1000, // 24 hours in ms
            });
        });

        it("emails the correct reset password link to the user", async () => {
            const host = 'app.landexplorer.coop';
            const testUrlEncodedEmail = 'douglas.quaid%40yahoomail.com';
            const expectedResetLink = `https://${host}/auth?email=${testUrlEncodedEmail}&reset_token=${testRandomToken}`;

            await server.inject({
                method: "POST",
                url: "/api/user/password-reset",
                authority: host,
                payload: {
                    username: testEmail
                }
            });

            // We get the arguments that were passed to the spy in the 'sendResetPasswordEmail' call
            // and make assertions on them
            const actualResetLink = fakeSendResetPasswordEmail.getCall(0).args[2];
            expect(actualResetLink).to.equal(expectedResetLink);
        });

        it("returns status 200", async () => {
            const res = await server.inject({
                method: "POST",
                url: "/api/user/password-reset",
                payload: {
                    username: testEmail
                }
            });

            expect(res.statusCode).to.equal(200);
        });
    });

    context("User doesn't exist", async () => {

        beforeEach(() => {
            // fake User.findOne to return our test user
            sandbox.replace(Model.User, "findOne", fake.returns(null));
        });

        it("doesn't send a password reset email", async () => {
            await server.inject({
                method: "POST",
                url: "/api/user/password-reset",
                payload: {
                    username: testEmail
                }
            });

            assert.notCalled(fakeSendResetPasswordEmail);
        });

        // To avoid username guesses by hacker
        it("returns status 200", async () => {
            const res = await server.inject({
                method: "POST",
                url: "/api/user/password-reset",
                payload: {
                    username: testEmail
                }
            });

            expect(res.statusCode).to.equal(200);
        });

    });
});
