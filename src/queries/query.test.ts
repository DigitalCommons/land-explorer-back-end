/// <reference types="mocha" />
import { expect } from "chai";
import { assert, createSandbox, fake, type SinonSpy } from "sinon";
import * as query from "./query";
import * as bcrypt from "bcrypt";
import {
  User,
  PasswordResetToken,
  UserGroupMembership,
  Marker,
  Polygon,
  Line,
  DataGroup,
  UserGroup,
  DataGroupMembership,
  sequelize,
} from "../queries/database";
import * as instrument from "../instrument";
const sandbox = createSandbox();

describe("Check and return user", () => {
  const testUserId = 123;
  const testUsername = "douglas.quaid@yahoomail.com";
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
      sandbox.stub((bcrypt as any).default, "compare").resolves(true);
      sandbox.stub(User, "findOne").resolves(testUser);

      const result = await query.checkAndReturnUser(testUsername, "p4ssw0rd");

      expect(result.user).to.deep.equal(testUser);
    });

    it("fails if incorrect password", async () => {
      sandbox.stub((bcrypt as any).default, "compare").resolves(false);
      sandbox.replace(User, "findOne", fake.resolves(testUser));

      const result = await query.checkAndReturnUser(
        testUsername,
        "bad-password",
      );

      expect(result.success).to.equal(false);
      expect(result.errorMessage).to.equal(
        "You have entered an invalid username or password.",
      );
    });

    it("fails if user doesn't exist", async () => {
      sandbox.replace(User, "findOne", fake.resolves(null));
      const result = await query.checkAndReturnUser(testUsername, "p4ssw0rd");

      expect(result.success).to.equal(false);
      expect(result.errorMessage).to.equal(
        "You have entered an invalid username or password.",
      );
    });
  });

  context("username and token given", () => {
    const testExpiryTime = Date.now() + 100000; // 100 seconds after now
    const testToken = {
      id: 1,
      user_id: testUserId,
      token: "t0k3n",
      expires: testExpiryTime,
    };

    let fakePasswordResetTokenDestroy: SinonSpy;

    beforeEach(() => {
      fakePasswordResetTokenDestroy = sandbox.replace(
        PasswordResetToken,
        "destroy",
        fake(),
      );
    });

    it("returns the user if token matches and hasn't expired", async () => {
      sandbox.replace(User, "findOne", fake.resolves(testUser));
      sandbox.replace(PasswordResetToken, "findOne", fake.resolves(testToken));

      const result = await query.checkAndReturnUser(
        testUsername,
        undefined,
        "t0k3n",
      );

      expect(result.success).to.equal(true);
      expect(result.user).to.deep.equal(testUser);
    });

    it("fails if token doesn't exist for user", async () => {
      sandbox.replace(User, "findOne", fake.resolves(testUser));
      sandbox.replace(PasswordResetToken, "findOne", fake.resolves(null));

      const result = await query.checkAndReturnUser(
        testUsername,
        undefined,
        "non-existent-token",
      );

      expect(result.success).to.equal(false);
      expect(result.errorMessage).to.equal("Password reset link is invalid.");
    });

    it("fails if user doesn't exist", async () => {
      sandbox.replace(User, "findOne", fake.resolves(null));
      const result = await query.checkAndReturnUser(
        testUsername,
        undefined,
        "t0k3n",
      );

      expect(result.success).to.equal(false);
      expect(result.errorMessage).to.equal("Password reset link is invalid.");
    });

    it("fails if incorrect token", async () => {
      sandbox.replace(User, "findOne", fake.resolves(testUser));
      sandbox.replace(PasswordResetToken, "findOne", fake.resolves(testToken));

      const result = await query.checkAndReturnUser(
        testUsername,
        undefined,
        "bad-token",
      );

      expect(result.success).to.equal(false);
      expect(result.errorMessage).to.equal("Password reset link is invalid.");
    });

    it("fails if token has expired", async () => {
      const testOldToken = {
        ...testToken,
        expires: Date.now() - 1000, // 1 s before now
      };
      sandbox.replace(User, "findOne", fake.resolves(testUser));
      sandbox.replace(
        PasswordResetToken,
        "findOne",
        fake.resolves(testOldToken),
      );

      const result = await query.checkAndReturnUser(
        testUsername,
        undefined,
        "t0k3n",
      );

      expect(result.success).to.equal(false);
      expect(result.errorMessage).to.equal(
        "Link has expired. Please make a new password reset request.",
      );
    });

    it("deletes the one-time token", async () => {
      sandbox.replace(User, "findOne", fake.resolves(testUser));
      sandbox.replace(PasswordResetToken, "findOne", fake.resolves(testToken));

      await query.checkAndReturnUser(testUsername, undefined, "t0k3n");

      assert.calledOnceWithMatch(fakePasswordResetTokenDestroy, {
        where: {
          user_id: testUserId,
        },
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
    "There is a user group (1) associated with 1 data group containing 1 marker, and a user group (2) associated with a data group containing 1 polygon",
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
        name: "User Group (1)",
      };

      const testDataGroup1 = {
        iddata_groups: 1,
        title: "Data Group (1)",
        hex_colour: "#FF0001",
      };

      const testUserGroup2 = {
        iduser_groups: 2,
        name: "User Group (2)",
      };

      const testDataGroup2 = {
        iddata_groups: 2,
        title: "Data Group (2)",
        hex_colour: "#FF0002",
      };

      beforeEach(() => {
        sandbox.replace(
          UserGroup,
          "findOne",
          fake((options) => {
            return options.where.iduser_groups === testUserGroup1.iduser_groups
              ? testUserGroup1
              : testUserGroup2;
          }),
        );

        sandbox.replace(
          DataGroupMembership,
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
          }),
        );

        sandbox.replace(
          DataGroup,
          "findOne",
          fake((options) => {
            return options.where.iddata_groups === testDataGroup1.iddata_groups
              ? testDataGroup1
              : testDataGroup2;
          }),
        );

        sandbox.replace(
          Marker,
          "findAll",
          fake((options) => {
            return options.where.data_group_id === testDataGroup1.iddata_groups
              ? [testMarker]
              : [];
          }),
        );
        sandbox.replace(
          Polygon,
          "findAll",
          fake((options) => {
            return options.where.data_group_id === testDataGroup2.iddata_groups
              ? [testPolygon]
              : [];
          }),
        );
        sandbox.replace(Line, "findAll", fake.resolves([]));
      });

      it("Returns the datagroups for a usergroup with readwrite access and a public usergroup with readonly access", async () => {
        sandbox.replace(
          UserGroupMembership,
          "findAll",
          fake.resolves([
            {
              iduser_group_memberships: 1,
              user_id: -1, // -1 means public
              user_group_id: testUserGroup1.iduser_groups,
              access: 1, // readonly access
            },
            {
              iduser_group_memberships: 2,
              user_id: testUserId,
              user_group_id: testUserGroup2.iduser_groups,
              access: 3, // readwrite access
            },
          ]),
        );

        const result = await query.findAllDataGroupContentForUser(testUserId);

        const expectedContent = [
          {
            name: testUserGroup1.name,
            id: testUserGroup1.iduser_groups,
            access: 1,
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
            access: 3,
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

      it("Returns the higher access level if a user has readwrite access to a public usergroup", async () => {
        sandbox.replace(
          UserGroupMembership,
          "findAll",
          fake.resolves([
            {
              iduser_group_memberships: 1,
              user_id: -1, // -1 means public
              user_group_id: testUserGroup1.iduser_groups,
              access: 1, // readonly access
            },
            {
              iduser_group_memberships: 2,
              user_id: testUserId,
              user_group_id: testUserGroup1.iduser_groups,
              access: 3, // readwrite access
            },
          ]),
        );

        const result = await query.findAllDataGroupContentForUser(testUserId);

        const expectedContent = [
          {
            name: testUserGroup1.name,
            id: testUserGroup1.iduser_groups,
            access: 3,
            dataGroups: [
              {
                ...testDataGroup1,
                markers: [testMarker],
                polygons: [],
                lines: [],
              },
            ],
          },
        ];

        expect(result).to.deep.equal(expectedContent);
      });
    },
  );
});

describe("trackUserEvent", () => {
  const testUserId = 456;
  const testUserCreatedDate = "2023-01-15 10:30:00";
  let trackRawEventSpy: SinonSpy;

  beforeEach(() => {
    sandbox.replace(sequelize, "query", fake.resolves(null));

    // Stub trackRawEvent to capture what it's called with
    trackRawEventSpy = sandbox.spy(instrument, "trackRawEvent");
  });

  afterEach(() => {
    sandbox.restore();
  });

  context("User exists", () => {
    beforeEach(() => {
      sandbox.replace(
        User,
        "findOne",
        fake.resolves({
          id: testUserId,
          created_date: testUserCreatedDate,
        }),
      );
    });

    it("calls trackRawEvent with consistent hashed userID", async () => {
      await query.trackUserEvent(testUserId, "User_Register");

      expect(trackRawEventSpy.calledOnce).to.be.true;
      const [event, data] = trackRawEventSpy.firstCall.args;

      expect(event).to.equal("User_Register");
      expect(data.distinct_id).to.equal("99a70b2e9c66404d");
    });

    it("merges additional data", async () => {
      const additionalData = { shared_maps: true };

      await query.trackUserEvent(testUserId, "User_Register", additionalData);

      const [, data] = trackRawEventSpy.firstCall.args;
      expect(data).to.deep.equal({
        shared_maps: true,
        distinct_id: data.distinct_id, // just verify it exists
        user_groups: [],
      });
    });

    it("produces different hash for different userId", async () => {
      await query.trackUserEvent(testUserId + 1, "User_Register");
      const [, data] = trackRawEventSpy.firstCall.args;
      expect(data.distinct_id).to.not.equal("99a70b2e9c66404d");
    });
  });

  context("User doesn't exist", () => {
    beforeEach(() => {
      sandbox.replace(User, "findOne", fake.resolves(null));
    });

    it("uses USER_NOT_FOUND as hashed userId", async () => {
      await query.trackUserEvent(testUserId, "User_Register");
      const [, data] = trackRawEventSpy.firstCall.args;
      expect(data.distinct_id).to.equal("USER_NOT_FOUND");
    });
  });
});

describe("groupPolysByTitleNo", () => {
  context("Simple case", () => {
    it("returns polygons grouped by title_no", () => {
      const polygons = [
        {
          title_no: "NN123456",
          poly_id: "1",
          polyCreatedAt: "2025-11-08 04:31:35",
          polyUpdatedAt: "2025-11-08 04:31:35",
          geom: {
            type: "Polygon",
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [0, 1],
                [0, 0],
              ],
            ],
          },
        },
        {
          title_no: "NN123456",
          poly_id: "2",
          polyCreatedAt: "2024-11-02 16:51:15",
          polyUpdatedAt: "2025-11-08 04:31:35",
          geom: {
            type: "Polygon",
            coordinates: [
              [
                [2, 2],
                [2, 3],
                [3, 2],
                [2, 2],
              ],
            ],
          },
        },
        {
          title_no: "PQ809176",
          poly_id: "3",
          polyCreatedAt: "2022-11-08 00:32:56",
          polyUpdatedAt: "2022-11-08 00:32:56",
          geom: {
            type: "Polygon",
            coordinates: [
              [
                [3, 3],
                [3, 4],
                [4, 3],
                [3, 3],
              ],
            ],
          },
        },
      ];
      const result = query.groupPolysByTitleNo(polygons);
      expect(result).to.deep.equal({
        NN123456: {
          title_no: "NN123456",
          polygons: [
            {
              poly_id: "1",
              createdAt: "2025-11-08 04:31:35",
              updatedAt: "2025-11-08 04:31:35",
              geom: {
                type: "Polygon",
                coordinates: [
                  [
                    [0, 0],
                    [1, 0],
                    [0, 1],
                    [0, 0],
                  ],
                ],
              },
            },
            {
              poly_id: "2",
              createdAt: "2024-11-02 16:51:15",
              updatedAt: "2025-11-08 04:31:35",
              geom: {
                type: "Polygon",
                coordinates: [
                  [
                    [2, 2],
                    [2, 3],
                    [3, 2],
                    [2, 2],
                  ],
                ],
              },
            },
          ],
        },
        PQ809176: {
          title_no: "PQ809176",
          polygons: [
            {
              poly_id: "3",
              createdAt: "2022-11-08 00:32:56",
              updatedAt: "2022-11-08 00:32:56",
              geom: {
                type: "Polygon",
                coordinates: [
                  [
                    [3, 3],
                    [3, 4],
                    [4, 3],
                    [3, 3],
                  ],
                ],
              },
            },
          ],
        },
      });
    });
  });

  context("There are polygons with null/empty title_no", () => {
    it("polys with null/empty title_no get a dummy title_no of the form 'unknown_<poly_id>'", () => {
      const polygons = [
        {
          title_no: null,
          poly_id: "1",
          polyCreatedAt: "2025-11-08 04:31:35",
          polyUpdatedAt: "2025-11-08 04:31:35",
          geom: {
            type: "Polygon",
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
                [0, 0],
              ],
            ],
          },
        },
        {
          title_no: "",
          poly_id: "2",
          polyCreatedAt: "2025-11-08 04:31:35",
          polyUpdatedAt: "2025-11-08 04:31:35",
          geom: {
            type: "Polygon",
            coordinates: [
              [
                [2, 2],
                [3, 2],
                [3, 3],
                [2, 3],
                [2, 2],
              ],
            ],
          },
        },
      ];
      const result = query.groupPolysByTitleNo(polygons);
      expect(result).to.deep.equal({
        unknown_1: {
          title_no: "unknown_1",
          polygons: [
            {
              poly_id: "1",
              createdAt: "2025-11-08 04:31:35",
              updatedAt: "2025-11-08 04:31:35",
              geom: {
                type: "Polygon",
                coordinates: [
                  [
                    [0, 0],
                    [1, 0],
                    [1, 1],
                    [0, 1],
                    [0, 0],
                  ],
                ],
              },
            },
          ],
        },
        unknown_2: {
          title_no: "unknown_2",
          polygons: [
            {
              poly_id: "2",
              createdAt: "2025-11-08 04:31:35",
              updatedAt: "2025-11-08 04:31:35",
              geom: {
                type: "Polygon",
                coordinates: [
                  [
                    [2, 2],
                    [3, 2],
                    [3, 3],
                    [2, 3],
                    [2, 2],
                  ],
                ],
              },
            },
          ],
        },
      });
    });
  });

  it("should handle an empty array", () => {
    const polygons = [];
    const result = query.groupPolysByTitleNo(polygons);
    expect(result).to.deep.equal({});
  });
});
