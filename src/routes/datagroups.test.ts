import { expect } from "chai";
import { createSandbox, fake } from "sinon"
import { Server } from "@hapi/hapi";
import { init } from "../server"
import { UserMapAccess } from "../queries/database";

// Dependencies to be stubbed
const Model = require("../queries/database");
const query = require("../queries/query");

const sandbox = createSandbox();

describe("GET /api/user/datagroups", () => {
    let server: Server;
    const getUserDataGroupsRequest = {
        method: "GET",
        url: "/api/user/datagroups",
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

    context("User has no usergroups", () => {
        beforeEach(() => {
          sandbox.replace(Model.UserGroupMembership, "findAll", fake.resolves([]));
        });
    
        it("returns status 200", async () => {
          const res = await server.inject(getUserDataGroupsRequest);
    
          expect(res.statusCode).to.equal(200);
        });
    
        it("no usergroups are returned", async () => {
          const res = await server.inject(getUserDataGroupsRequest);
    
          expect(res.result).to.be.an("array").that.is.empty;
        });
    });

    context("User has one usergroup with one datagroup with one polygon", () => {
        beforeEach(()=>{
            const userGroupMemberships = [{user_group_id: 1, access: 1}];
            sandbox.replace(Model.UserGroupMembership,"findAll",fake.resolves(userGroupMemberships));
            
            const userGroup = {iduser_groups: 1, name: "test user group" };
            sandbox.replace(Model.UserGroup, "findOne",fake.resolves(userGroup));
            
            const dataGroupMemberships = [{user_group_id: 1}];
            sandbox.replace(Model.DataGroupMembership,"findAll",fake.resolves(dataGroupMemberships));
            
            const dataGroup = {iddata_groups: 1, show_marker_in_polys: true, name: "test data group"};
            sandbox.replace(Model.DataGroup,"findOne",fake.resolves(dataGroup));
            
            const polygons = [{
                idpolygons: 1,
                name: "test polygon",
                description: "beautiful test polygon",
                data_group_id: 1,
                vertices: {"type":"Polygon","coordinates":[[[-1.143789225981891,52.60784581928385],[-1.149024679300993,52.60293952745337],[-1.1385086394440975,52.60293952745337],[-1.143789225981891,52.60784581928385]]]},
                center: [-1.1438320245605098,52.604911886975856],
                length: 2.0120302126744383,
                area: 194143.14948973656,
                uuid: "7e4491b9-cf35-4015-b041-205706694dba",
              }
            ]
            sandbox.replace(Model.Polygon,"findAll", fake.resolves(polygons));
        
            sandbox.replace(Model.Marker,"findAll", fake.resolves([]));
            sandbox.replace(Model.Line,"findAll", fake.resolves([]));
        })

        it("returns status 200", async () => {
            const res = await server.inject(getUserDataGroupsRequest);
      
            expect(res.statusCode).to.equal(200);
        });

        it("1 datagroup is returned, containing the polygon", async () => {
            const res = await server.inject(getUserDataGroupsRequest);

            expect(res.result).to.deep.equal([{
                    "access": 1,
                    "dataGroups": [
                      {
                        "iddata_groups": 1,
                        "lines": [],
                        "markers": [],
                        "name": "test data group",
                        "polygons": [
                         {
                            "area": 194143.14948973656,
                            "center": [
                              -1.1438320245605098,
                              52.604911886975856
                            ],
                            "data_group_id": 1,
                            "description": "beautiful test polygon",
                            "idpolygons": 1,
                            "length": 2.0120302126744383,
                            "name": "test polygon",
                            "uuid": "7e4491b9-cf35-4015-b041-205706694dba",
                            "vertices": {
                              "coordinates": [
                                [
                                  [
                                    -1.143789225981891,
                                    52.60784581928385
                                  ],
                                  [
                                    -1.149024679300993,
                                    52.60293952745337
                                  ],
                                  [
                                    -1.1385086394440975,
                                    52.60293952745337
                                  ],
                                  [
                                    -1.143789225981891,
                                    52.60784581928385
                                  ]
                                ]
                              ],
                              "type": "Polygon"
                            }
                          }
                        ],
                        "show_marker_in_polys": true
                      }
                    ],
                    "id": 1,
                    "name": "test user group"
            }]);
        })
    })
})
