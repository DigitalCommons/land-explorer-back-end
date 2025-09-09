import { expect } from "chai";
import { createSandbox, fake } from "sinon"
import { Server } from "@hapi/hapi";
import { init } from "../server"
import { UserMapAccess } from "../queries/database";

// Dependencies to be stubbed
const Model = require("../queries/database");
const query = require("../queries/query");

const sandbox = createSandbox();

describe("GET /api/user/maps", () => {
  let server: Server;
  const getUserMapsRequest = {
    method: "GET",
    url: "/api/user/maps",
    auth: {
      strategy: "simple",
      credentials: {
        user_id: 123,
      },
    },
  };

  beforeEach(async () => {
    server = await init();
  });

  afterEach(async () => {
    await server.stop();
    sandbox.restore();
  });

  context("User has no maps", () => {
    beforeEach(() => {
      sandbox.replace(Model.Map, "findAll", fake.resolves([]));
    });

    it("returns status 200", async () => {
      const res = await server.inject(getUserMapsRequest);

      expect(res.statusCode).to.equal(200);
    });

    it("no maps are returned", async () => {
      const res = await server.inject(getUserMapsRequest);

      expect(res.result).to.be.an("array").that.is.empty;
    });
  });

  context(
    `User has 1 map, shared with 2 users (write access) and 1 pending user (read-only)`,
    () => {
      const testMapId = 1;
      const testMapName = "test map";
      const testMapData = `{"map":{"zoom":[8],"lngLat":[-2.4,54.1],"gettingLocation":false,"currentLocation":null,"movingMethod":"flyTo","name":"test map"},"drawings":{"polygons":[],"activePolygon":null,"polygonCount":0,"lineCount":0,"loadingDrawings":false},"markers":{"markers":[]},"mapLayers":{"landDataLayers":[],"myDataLayers":[]},"version":"1.1","name":"test map"}`;
      const testMapCreatedData = "2023-01-19 03:14:07";
      const testMapLastModified = "2023-01-22 06:24:11";

      beforeEach(() => {
        const testMap = {
          id: testMapId,
          name: testMapName,
          data: testMapData,
          deleted: 0,
          is_snapshot: false,
          created_date: testMapCreatedData,
          last_modified: testMapLastModified,
          UserMaps: [
            {
              id: 1,
              viewed: 1,
              map_id: testMapId,
              user_id: 1,
              access: 2,
              created_date: testMapCreatedData,
            },
          ],
        };
        // fake Map.findAll and Map.findOne return the same single Map
        sandbox.replace(Model.Map, "findAll", fake.resolves([testMap]));
        sandbox.replace(Model.Map, "findOne", fake.resolves(testMap));

        // fake MapMembership.findAll to return empty array
        sandbox.replace(Model.MapMembership, "findAll", fake.resolves([]));

        // fake UserMap.findAll to return 2 UserMaps and associated fake Users
        sandbox.replace(
          Model.UserMap,
          "findAll",
          fake.resolves([
            {
              id: 2,
              viewed: 1,
              map_id: testMapId,
              user_id: 2,
              access: UserMapAccess.Readwrite,
              User: {
                id: 2,
                username: "user2@mail.coop",
              },
            },
            {
              id: 3,
              viewed: 0,
              map_id: testMapId,
              user_id: 3,
              access: UserMapAccess.Readwrite,
              User: {
                id: 3,
                username: "user3@mail.coop",
              },
            },
          ])
        );

        // fake 1 PendingUser
        sandbox.replace(
          Model.PendingUserMap,
          "findAll",
          fake.resolves([
            {
              id: 1,
              email_address: "pendingUser@mail.coop",
              access: UserMapAccess.Readonly,
              map_id: testMapId,
            },
          ])
        );
      });

      it("returns status 200", async () => {
        const res = await server.inject(getUserMapsRequest);

        expect(res.statusCode).to.equal(200);
      });

      it("1 map is returned, containing data about users that it is shared with", async () => {
        const res = await server.inject(getUserMapsRequest);

        // Use deep equal to match values within the array rather than strict object equality
        expect(res.result).to.deep.equal([
          {
            map: {
              eid: testMapId,
              name: testMapName,
              data: testMapData,
              createdDate: testMapCreatedData,
              lastModified: testMapLastModified,
              sharedWith: [
                {
                  email: "user2@mail.coop",
                  access: UserMapAccess.Readwrite,
                },
                {
                  email: "user3@mail.coop",
                  access: UserMapAccess.Readwrite,
                },
                {
                  email: "pendingUser@mail.coop",
                  access: UserMapAccess.Readonly,
                },
              ],
              isSnapshot: false,
            },
            accessGrantedDate: testMapCreatedData,
            access: 2,
            viewed: true,
          },
        ]);
      });
    }
  );

  describe("PBS enrichment", () => {
    // New tests for enrichment of highlighted title numbers from PBS (no legacy fallback)
    context("Map has highlighted title numbers and PBS returns rows", () => {
      const testMapId = 11;
      const testMapName = "map with titles";
      const testMapData = JSON.stringify({
        map: { zoom: [8], lngLat: [-2.4, 54.1], name: testMapName },
        drawings: {
          polygons: [],
          activePolygon: null,
          polygonCount: 0,
          lineCount: 0,
          loadingDrawings: false,
        },
        markers: { markers: [] },
        mapLayers: { landDataLayers: [], myDataLayers: [] },
        // << Only supported location >>
        landOwnership: { highlightedTitleNumbers: ["TEST-T1", "TEST-T2"] },
        version: "1.1",
        name: testMapName,
      });
      const testMapCreatedData = "2025-01-01 10:00:00";
      const testMapLastModified = "2025-01-02 12:00:00";

      // Rows the PBS (via backend `query.getPolygonsByTitleNumbers`) would return
      const pbsRows = [
        {
          poly_id: 2000001,
          title_no: "TEST-T1",
          tenure: "Freehold",
          geom: {
            type: "Polygon",
            coordinates: [
              [
                [0, 0],
                [0, 1],
                [1, 1],
                [0, 1],
                [0, 0],
              ],
            ],
          },
        },
        {
          poly_id: 2000002,
          title_no: "TEST-T2",
          tenure: "Leasehold",
          geom: {
            type: "Polygon",
            coordinates: [
              [
                [1, 1],
                [1, 2],
                [2, 2],
                [1, 2],
                [1, 1],
              ],
            ],
          },
        },
      ];

      beforeEach(() => {
        const testMap = {
          id: testMapId,
          name: testMapName,
          data: testMapData,
          deleted: 0,
          is_snapshot: false,
          created_date: testMapCreatedData,
          last_modified: testMapLastModified,
          UserMaps: [
            {
              id: 1,
              viewed: 1,
              map_id: testMapId,
              user_id: 123,
              access: UserMapAccess.Owner,
              created_date: testMapCreatedData,
            },
          ],
        };

        // DB lookups
        sandbox.replace(Model.Map, "findAll", fake.resolves([testMap]));
        sandbox.replace(Model.Map, "findOne", fake.resolves(testMap));

        // Keep drawings empty so the rest of the code path is exercised without extra setup
        sandbox.replace(Model.MapMembership, "findAll", fake.resolves([]));
        sandbox.replace(Model.UserMap, "findAll", fake.resolves([]));
        sandbox.replace(Model.PendingUserMap, "findAll", fake.resolves([]));

        // Stub the enrichment call
        sandbox.replace(
          query,
          "getPolygonsByTitleNumbers",
          fake.resolves(pbsRows)
        );
      });

      it("returns 200 and hydrates highlighted properties from PBS", async () => {
        const res: any = await server.inject(getUserMapsRequest);
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.be.an("array").with.lengthOf(1);

        const returned = res.result[0];
        expect(returned.map.eid).to.equal(testMapId);

        // The API returns map.data as a string — parse it and inspect the hydrated field
        const parsedData = JSON.parse(returned.map.data);
        expect(parsedData.landOwnership).to.be.an("object");
        expect(parsedData.landOwnership.highlightedProperties).to.deep.equal({
          2000001: pbsRows[0],
          2000002: pbsRows[1],
        });
      });
    });

    context(
      "Map has highlighted title numbers but PBS fails — response still succeeds",
      () => {
        const testMapId = 12;
        const testMapName = "map with titles (pbs fail)";
        const testMapData = JSON.stringify({
          map: { zoom: [8], lngLat: [-2.4, 54.1], name: testMapName },
          drawings: {
            polygons: [],
            activePolygon: null,
            polygonCount: 0,
            lineCount: 0,
            loadingDrawings: false,
          },
          markers: { markers: [] },
          mapLayers: { landDataLayers: [], myDataLayers: [] },
          // << Only supported location >>
          landOwnership: { highlightedTitleNumbers: ["TEST-T9"] },
          version: "1.1",
          name: testMapName,
        });

        beforeEach(() => {
          const testMap = {
            id: testMapId,
            name: testMapName,
            data: testMapData,
            deleted: 0,
            is_snapshot: false,
            created_date: "2025-01-01 10:00:00",
            last_modified: "2025-01-02 12:00:00",
            UserMaps: [
              {
                id: 1,
                viewed: 1,
                map_id: testMapId,
                user_id: 123,
                access: UserMapAccess.Owner,
                created_date: "2025-01-01 10:00:00",
              },
            ],
          };

          sandbox.replace(Model.Map, "findAll", fake.resolves([testMap]));
          sandbox.replace(Model.Map, "findOne", fake.resolves(testMap));
          sandbox.replace(Model.MapMembership, "findAll", fake.resolves([]));
          sandbox.replace(Model.UserMap, "findAll", fake.resolves([]));
          sandbox.replace(Model.PendingUserMap, "findAll", fake.resolves([]));

          // Make the PBS call reject — our handler should swallow and continue
          sandbox.replace(
            query,
            "getPolygonsByTitleNumbers",
            fake.rejects(new Error("PBS down"))
          );
        });

        it("returns 200 and leaves map data unchanged (no highlightedProperties)", async () => {
          const res: any = await server.inject(getUserMapsRequest);
          expect(res.statusCode).to.equal(200);
          expect(res.result).to.be.an("array").with.lengthOf(1);

          const parsedData = JSON.parse(res.result[0].map.data);
          // landOwnership exists but enrichment failed, so highlightedProperties should be absent
          expect(parsedData.landOwnership).to.be.an("object");
          expect(parsedData.landOwnership.highlightedProperties).to.equal(
            undefined
          );
        });
      }
    );
  });
  // End of PBS enrichment tests (legacy fallback removed)
});

describe("GET /api/ownership", () => {
  let server: Server;

  const getLandOwnershipPolygonsRequest = {
    method: "GET",
    url: "/api/ownership",
    auth: {
      strategy: "simple",
      credentials: {
        user_id: 123,
      },
    },
  };

  beforeEach(async () => {
    server = await init();
    sandbox.replace(query, "getPolygons", fake.resolves([]));
    getLandOwnershipPolygonsRequest.url =
      "/api/ownership?sw_lng=0.3&sw_lat=53.2&ne_lng=0.4&ne_lat=53.3";
  });

  afterEach(async () => {
    await server.stop();
    sandbox.restore();
  });

  context("User is a super user", () => {
    beforeEach(() => {
      sandbox.replace(
        Model.User,
        "findOne",
        fake.resolves({
          id: 1,
          username: "user1@mail.coop",
          is_super_user: 1,
        })
      );
    });

    it("getting all polygons returns status 200", async () => {
      getLandOwnershipPolygonsRequest.url += "&type=all";
      const res = await server.inject(getLandOwnershipPolygonsRequest);
      expect(res.statusCode).to.equal(200);
    });

    it("getting undefined type (i.e. all) polygons returns status 200", async () => {
      const res = await server.inject(getLandOwnershipPolygonsRequest);
      expect(res.statusCode).to.equal(200);
    });

    it("getting localAuthority polygons returns status 200", async () => {
      getLandOwnershipPolygonsRequest.url += "&type=localAuthority";
      const res = await server.inject(getLandOwnershipPolygonsRequest);
      expect(res.statusCode).to.equal(200);
    });

    it("getting churchOfEngland polygons returns status 200", async () => {
      getLandOwnershipPolygonsRequest.url += "&type=churchOfEngland";
      const res = await server.inject(getLandOwnershipPolygonsRequest);
      expect(res.statusCode).to.equal(200);
    });

    it("getting pending polygons returns status 200", async () => {
      getLandOwnershipPolygonsRequest.url += "&type=pending";
      const res = await server.inject(getLandOwnershipPolygonsRequest);
      expect(res.statusCode).to.equal(200);
    });

    it("getting unknown type of polygons returns status 400", async () => {
      getLandOwnershipPolygonsRequest.url += "&type=aharheh";
      const res = await server.inject(getLandOwnershipPolygonsRequest);
      expect(res.statusCode).to.equal(400);
    });
  });

  context(`User is not a super user`, () => {
    beforeEach(() => {
      sandbox.replace(Model.User, "findOne", fake.resolves(null));
    });

    it("getting all polygons returns status 200", async () => {
      getLandOwnershipPolygonsRequest.url += "&type=all";
      const res = await server.inject(getLandOwnershipPolygonsRequest);
      expect(res.statusCode).to.equal(200);
    });

    it("getting undefined type (i.e. all) polygons returns status 200", async () => {
      const res = await server.inject(getLandOwnershipPolygonsRequest);
      expect(res.statusCode).to.equal(200);
    });

    it("getting localAuthority polygons returns status 200", async () => {
      getLandOwnershipPolygonsRequest.url += "&type=localAuthority";
      const res = await server.inject(getLandOwnershipPolygonsRequest);
      expect(res.statusCode).to.equal(200);
    });

    it("getting churchOfEngland polygons returns status 200", async () => {
      getLandOwnershipPolygonsRequest.url += "&type=churchOfEngland";
      const res = await server.inject(getLandOwnershipPolygonsRequest);
      expect(res.statusCode).to.equal(200);
    });

    it("getting pending polygons returns status 403", async () => {
      getLandOwnershipPolygonsRequest.url += "&type=pending";
      const res = await server.inject(getLandOwnershipPolygonsRequest);
      expect(res.statusCode).to.equal(403);
    });

    it("getting unknown type of polygons returns status 400", async () => {
      getLandOwnershipPolygonsRequest.url += "&type=kdukukg";
      const res = await server.inject(getLandOwnershipPolygonsRequest);
      expect(res.statusCode).to.equal(400);
    });
  });
});


describe("GET /api/user/maps – PBS integration", () => {
  let server: Server;

  const getUserMapsRequest = {
    method: "GET",
    url: "/api/user/maps",
    auth: {
      strategy: "simple",
      credentials: { user_id: 123 },
    },
  };

  const testMapId = 911;
  const testMapName = "integration map";
  const testMapData = JSON.stringify({
    map: { zoom: [8], lngLat: [-2.4, 54.1], name: testMapName },
    drawings: {
      polygons: [],
      activePolygon: null,
      polygonCount: 0,
      lineCount: 0,
      loadingDrawings: false,
    },
    markers: { markers: [] },
    mapLayers: { landDataLayers: [], myDataLayers: [] },
    landOwnership: { highlightedTitleNumbers: ["TEST-T1", "TEST-T2"] },
    version: "1.1",
    name: testMapName,
  });

  beforeEach(async () => {
    server = await init();

    // DB still mocked: we just return one map owned by the user.
    const testMap = {
      id: testMapId,
      name: testMapName,
      data: testMapData,
      deleted: 0,
      is_snapshot: false,
      created_date: "2025-01-01 10:00:00",
      last_modified: "2025-01-02 12:00:00",
      UserMaps: [
        {
          id: 1,
          viewed: 1,
          map_id: testMapId,
          user_id: 123,
          access: UserMapAccess.Owner,
          created_date: "2025-01-01 10:00:00",
        },
      ],
    };

    // Reuse the top-level sandbox
    sandbox.replace(Model.Map, "findAll", fake.resolves([testMap]));
    sandbox.replace(Model.Map, "findOne", fake.resolves(testMap));
    sandbox.replace(Model.MapMembership, "findAll", fake.resolves([]));
    sandbox.replace(Model.UserMap, "findAll", fake.resolves([]));
    sandbox.replace(Model.PendingUserMap, "findAll", fake.resolves([]));
    // IMPORTANT: do NOT stub query.getPolygonsByTitleNumbers here
  });

  afterEach(async () => {
    await server.stop();
    sandbox.restore();
  });

  // Only run this when PBS is running locally and env is set
  const runPBS = process.env.RUN_PBS_INTEGRATION === "1";
  (runPBS ? it : it.skip)(
    "calls PBS for highlighted title numbers and hydrates map data",
    async function () {
      this.timeout(15000);

      // Sanity check env needed by backend call
      expect(process.env.BOUNDARY_SERVICE_URL).to.be.a("string");
      expect(process.env.BOUNDARY_SERVICE_SECRET).to.be.a("string");

      const res: any = await server.inject(getUserMapsRequest);
      expect(res.statusCode).to.equal(200);
      expect(res.result).to.be.an("array").with.lengthOf(1);

      const parsed = JSON.parse(res.result[0].map.data);
      expect(parsed.landOwnership).to.be.an("object");
      expect(parsed.landOwnership.highlightedProperties).to.be.an("object");

      // Your PBS seed returns 3 rows total for T1/T2 (two parcels for T1, one for T2)
      const keys = Object.keys(parsed.landOwnership.highlightedProperties);
      expect(keys.length).to.equal(3);

      const anyRow = parsed.landOwnership.highlightedProperties[keys[0]];
      expect(anyRow).to.have.property("title_no");
      expect(["TEST-T1", "TEST-T2"]).to.include(anyRow.title_no);
      expect(anyRow).to.have.property("geom");
    }
  );
});
