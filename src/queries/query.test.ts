import { expect } from "chai";
import { assert, createSandbox, fake, SinonSpy } from "sinon"

// Dependencies to be stubbed
const bcrypt = require("bcrypt");
const Model = require("../queries/database");

// Unit under test
const query = require("./query");

const sandbox = createSandbox();

describe("Check and return user", () => {
    const testUserId = 123;
    const testUsername = 'douglas.quaid@yahoomail.com';
    const testUser = {
        id: testUserId,
        username: testUsername,
        council_id: 0,
        is_super_user: 0,
        enabled: 1,
        marketing: 1,
    };

    afterEach(() => {
        sandbox.restore();
    });

    context("username and password given", () => {
        it("returns the user if password matches", async () => {
            sandbox.replace(bcrypt, "compare", fake.resolves(true));
            sandbox.replace(Model.User, "findOne", fake.resolves(testUser));

            const result = await query.checkAndReturnUser(testUsername, 'p4ssw0rd');

            expect(result.user).to.deep.equal(testUser);
        });

        it("fails if incorrect password", async () => {
            sandbox.replace(bcrypt, "compare", fake.resolves(false));
            sandbox.replace(Model.User, "findOne", fake.resolves(testUser));

            const result = await query.checkAndReturnUser(testUsername, 'bad-password');

            expect(result.success).to.equal(false);
            expect(result.errorMessage).to.equal('You have entered an invalid username or password.');
        });

        it("fails if user doesn't exist", async () => {
            sandbox.replace(Model.User, "findOne", fake.resolves(null));
            const result = await query.checkAndReturnUser(testUsername, 'p4ssw0rd');

            expect(result.success).to.equal(false);
            expect(result.errorMessage).to.equal('You have entered an invalid username or password.');
        });
    });

    context("username and token given", () => {
        const testExpiryTime = Date.now() + 100000; // 100 seconds after now
        const testToken = {
            id: 1,
            user_id: testUserId,
            token: 't0k3n',
            expires: testExpiryTime
        };

        let fakePasswordResetTokenDestroy: SinonSpy;

        beforeEach(() => {
            fakePasswordResetTokenDestroy = sandbox.replace(Model.PasswordResetToken, "destroy", fake());
        });

        it("returns the user if token matches and hasn't expired", async () => {
            sandbox.replace(Model.User, "findOne", fake.resolves(testUser));
            sandbox.replace(Model.PasswordResetToken, "findOne", fake.resolves(testToken));

            const result = await query.checkAndReturnUser(testUsername, undefined, 't0k3n');

            expect(result.success).to.equal(true);
            expect(result.user).to.deep.equal(testUser);
        });

        it("fails if token doesn't exist for user", async () => {
            sandbox.replace(Model.User, "findOne", fake.resolves(testUser));
            sandbox.replace(Model.PasswordResetToken, "findOne", fake.resolves(null));

            const result = await query.checkAndReturnUser(testUsername, undefined, 'non-existent-token');

            expect(result.success).to.equal(false);
            expect(result.errorMessage).to.equal('Password reset link is invalid.');
        });

        it("fails if user doesn't exist", async () => {
            sandbox.replace(Model.User, "findOne", fake.resolves(null));
            const result = await query.checkAndReturnUser(testUsername, undefined, 't0k3n');

            expect(result.success).to.equal(false);
            expect(result.errorMessage).to.equal('Password reset link is invalid.');
        });

        it("fails if incorrect token", async () => {
            sandbox.replace(Model.User, "findOne", fake.resolves(testUser));
            sandbox.replace(Model.PasswordResetToken, "findOne", fake.resolves(testToken));

            const result = await query.checkAndReturnUser(testUsername, undefined, 'bad-token');

            expect(result.success).to.equal(false);
            expect(result.errorMessage).to.equal('Password reset link is invalid.');
        });

        it("fails if token has expired", async () => {
            const testOldToken = {
                ...testToken,
                expires: Date.now() - 1000 // 1 s before now
            };
            sandbox.replace(Model.User, "findOne", fake.resolves(testUser));
            sandbox.replace(Model.PasswordResetToken, "findOne", fake.resolves(testOldToken));

            const result = await query.checkAndReturnUser(testUsername, undefined, 't0k3n');

            expect(result.success).to.equal(false);
            expect(result.errorMessage).to.equal('Link has expired. Please make a new password reset request.');
        });

        it("deletes the one-time token", async () => {
            sandbox.replace(Model.User, "findOne", fake.resolves(testUser));
            sandbox.replace(Model.PasswordResetToken, "findOne", fake.resolves(testToken));

            await query.checkAndReturnUser(testUsername, undefined, 't0k3n');

            assert.calledOnceWithMatch(fakePasswordResetTokenDestroy, {
                where: {
                    user_id: testUserId
                }
            });
        });
    });
});
