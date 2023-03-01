// chai provides assertions (e.g. expect, assert)
import { expect } from "chai";
// sinon provides fakes, spies, stubs, etc.
import { createSandbox, fake } from "sinon"
import { Server } from "@hapi/hapi";
import { init } from "../server"

// Dependencies to be stubbed https://sinonjs.org/how-to/stub-dependency/
const query = require('../queries/query');
const jwt = require("jsonwebtoken");

const sandbox = createSandbox();

// Describe the feature that we're testing
describe("Login", () => {
    let server: Server;

    const testUser = {
        id: 123,
        username: "test-lx@digitalcommons.coop",
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

        // Completely restore all fakes created through the sandbox
        sandbox.restore();
    });

    // Split into contexts for each scenario that could happen when using the feature
    context("Login found", () => {

        // This also runs before each 'it', after the 'beforeEach' on the level above
        beforeEach(() => {
            // Replace the query.checkAndReturnUser method with a fake that we can control to return
            // our test value. We do this because we don't want to the behaviour of the query module
            // to affect this unit test.
            // https://sinonjs.org/releases/latest/sandbox/#sandboxreplaceobject-property-replacement
            sandbox.replace(query, "checkAndReturnUser", fake.returns(testUser));
        });

        // A testcase for an individual behaviour
        it("returns status 200", async () => {
            const res = await server.inject({
                method: "POST",
                url: "/api/token",
                payload: {
                    username: "test-lx@digitalcommons.coop",
                    password: "testingtesting123"
                }
            });

            // The test passes or fails on this line
            expect(res.statusCode).to.equal(200);
        });

        it("token expires in 365 days", async () => {
            const res = await server.inject({
                method: "POST",
                url: "/api/token",
                payload: {
                    username: "test-lx@digitalcommons.coop",
                    password: "testingtesting123"
                }
            });

            const expectedExpiresIn = 365 * 24 * 60 * 60;
            expect(res.result).to.have.property('expires_in', expectedExpiresIn);
        });
    });

    context("Login not found", () => {
        beforeEach(() => {
            sandbox.replace(query, "checkAndReturnUser", fake.returns(false));
        });

        it("returns status 401", async () => {
            const res = await server.inject({
                method: "POST",
                url: "/api/token",
                payload: {
                    username: "test-lx@digitalcommons.coop",
                    password: "bad-password"
                }
            });

            expect(res.statusCode).to.equal(401);
        });
    });

    context("JWT signing throws error", () => {
        beforeEach(() => {
            sandbox.replace(query, "checkAndReturnUser", fake.returns(testUser));
            // Fake jwt.sign() so that it throws an error
            sandbox.replace(jwt, "sign", fake.throws("signing error"));
        });

        it("returns status 500", async () => {
            const res = await server.inject({
                method: "POST",
                url: "/api/token",
                payload: {
                    username: "test-lx@digitalcommons.coop",
                    password: "testingtesting123"
                }
            });

            expect(res.statusCode).to.equal(500);
        });
    });
});
