import { expect } from "chai";
import { createSandbox, fake } from "sinon"
import { Server } from "@hapi/hapi";
import { init } from "../server"
import { UserMapAccess } from "../queries/database";

// Dependencies to be stubbed
const Model = require("../queries/database");

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
});
