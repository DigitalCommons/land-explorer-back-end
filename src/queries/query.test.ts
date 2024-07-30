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

describe("findAllDataGroupContentForUser", () => {
  const testUserId = 123;

  afterEach(() => {
    sandbox.restore();
  });

  context(
    "User is in 1 user group and there is 1 public user group, each associated with 1 data group",
    () => {
      const testMarker = {
        idmarkers: 1,
        name: "Test Marker",
        description: "This is a datagroup marker",
        data_group_id: 1,
        location: {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [53.6, 12.1],
          },
        },
        uuid: "abc-001",
      };

      const testPolygon = {
        idpolygons: 1,
        name: "Test Polygon",
        description: "This is a datagroup polygon",
        data_group_id: 2,
        vertices: {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [125.6, 10.1],
                [125.7, 10.2],
                [125.6, 10.1],
              ],
            ],
          },
        },
        center: {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [125.63, 10.13],
          },
        },
        length: 100,
        area: 1000,
        uuid: "fgh-002",
      };

      const testUserGroup1 = {
        iduser_groups: 1,
        name: "Test User Group 1 (Public)",
      };

      const testDataGroup1 = {
        iddata_groups: 1,
        title: "Test Data Group 1 (Public)",
        hex_colour: "#FF0001",
      };

      const testUserGroup2 = {
        iduser_groups: 2,
        name: "Test User Group 2",
      };

      const testDataGroup2 = {
        iddata_groups: 2,
        title: "Test Data Group 2",
        hex_colour: "#FF0002",
      };

      it("returns user groups and associated data groups with markers, polygons, and lines", async () => {
        // Arrange

        sandbox.replace(
          Model.UserGroupMembership,
          "findAll",
          fake.resolves([
            {
              iduser_group_memberships: 1,
              user_id: -1, // -1 means public
              user_group_id: testUserGroup1.iduser_groups,
            },
            {
              iduser_group_memberships: 2,
              user_id: testUserId,
              user_group_id: testUserGroup2.iduser_groups,
            },
          ])
        );

        sandbox.replace(
          Model.UserGroup,
          "findOne",
          fake((options) => {
            return options.where.iduser_groups === testUserGroup1.iduser_groups
              ? testUserGroup1
              : testUserGroup2;
          })
        );

        sandbox.replace(
          Model.DataGroupMembership,
          "findAll",
          fake((options) => {
            return options.where.user_group_id === testUserGroup1.iduser_groups
              ? [
                  {
                    iddata_group_memberships: 1,
                    data_group_id: testDataGroup1.iddata_groups,
                    user_group_id: testUserGroup1.iduser_groups,
                  },
                ]
              : [
                  {
                    iddata_group_memberships: 2,
                    data_group_id: testDataGroup2.iddata_groups,
                    user_group_id: testUserGroup2.iduser_groups,
                  },
                ];
          })
        );

        sandbox.replace(
          Model.DataGroup,
          "findOne",
          fake((options) => {
            return options.where.iddata_groups === testDataGroup1.iddata_groups
              ? testDataGroup1
              : testDataGroup2;
          })
        );

        sandbox.replace(
          Model.Marker,
          "findAll",
          fake((options) => {
            return options.where.data_group_id === testDataGroup1.iddata_groups
              ? [testMarker]
              : [];
          })
        );
        sandbox.replace(
          Model.Polygon,
          "findAll",
          fake((options) => {
            return options.where.data_group_id === testDataGroup2.iddata_groups
              ? [testPolygon]
              : [];
          })
        );
        sandbox.replace(Model.Line, "findAll", fake.resolves([]));

        // Act

        const result = await query.findAllDataGroupContentForUser(testUserId);

        // Assert

        const expectedContent = [
          {
            name: testUserGroup1.name,
            id: testUserGroup1.iduser_groups,
            dataGroups: [
              {
                ...testDataGroup1,
                markers: [testMarker],
                polygons: [],
                lines: [],
              },
            ],
          },
          {
            name: testUserGroup2.name,
            id: testUserGroup2.iduser_groups,
            dataGroups: [
              {
                ...testDataGroup2,
                markers: [],
                polygons: [testPolygon],
                lines: [],
              },
            ],
          },
        ];

        expect(result).to.deep.equal(expectedContent);
      });
    }
  );
});
