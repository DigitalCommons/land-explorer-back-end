import { expect } from "chai";
import { createSandbox, fake } from "sinon";
import {
  trackUserMapEvent,
  compareMapDataChangesAndSendAnalytics,
  SaveMapData,
} from "./map";
import { Event } from "../instrument";

// Dependencies to be stubbed
const Model = require("./database");
const query = require("./query");

const sandbox = createSandbox();

describe("trackUserMapEvent", () => {
  const testMapId = 123;
  const testUserId = 456;
  const testMapCreatedDate = "2023-01-19 03:14:07";

  beforeEach(() => {
    // Stub trackUserEvent to capture what it's called with
    sandbox.replace(query, "trackUserEvent", fake.resolves(null));
  });

  afterEach(() => {
    sandbox.restore();
  });

  context("Map exists", () => {
    beforeEach(() => {
      sandbox.replace(
        Model.Map,
        "findOne",
        fake.resolves({
          id: testMapId,
          created_date: testMapCreatedDate,
        })
      );
    });

    it("calls trackUserEvent with consistent hashed mapId", async () => {
      await trackUserMapEvent(testUserId, testMapId, Event.MAP.OPEN);

      expect(query.trackUserEvent.calledOnce).to.be.true;
      const [userId, event, data] = (query.trackUserEvent as any).firstCall
        .args;

      expect(userId).to.equal(testUserId);
      expect(event).to.equal(Event.MAP.OPEN);
      expect(data.map_id).to.equal("0936b464a63bf05d"); // precomputed hash
    });

    it("merges additional data with hashed mapId", async () => {
      const additionalData = { drawn_count: 5, access: "Readonly" };

      await trackUserMapEvent(
        testUserId,
        testMapId,
        Event.MAP.SHARED_OPEN,
        additionalData
      );

      const [, , data] = (query.trackUserEvent as any).firstCall.args;

      expect(data).to.deep.equal({
        drawn_count: 5,
        access: "Readonly",
        map_id: data.map_id, // just verify it exists
      });
    });

    it("produces different hash for different mapId", async () => {
      await trackUserMapEvent(testUserId, testMapId + 1, Event.MAP.OPEN);
      const [, , data] = (query.trackUserEvent as any).firstCall.args;
      expect(data.map_id).to.not.equal("0936b464a63bf05d");
    });
  });

  context("Map doesn't exist", () => {
    beforeEach(() => {
      sandbox.replace(Model.Map, "findOne", fake.resolves(null));
    });

    it("uses MAP_NOT_FOUND as hashed mapId", async () => {
      await trackUserMapEvent(testUserId, testMapId, Event.MAP.OPEN);

      const [, , data] = (query.trackUserEvent as any).firstCall.args;
      expect(data.map_id).to.equal("MAP_NOT_FOUND");
    });
  });
});

describe("compareMapDataChangesAndSendAnalytics", () => {
  const testMapId = 123;
  const testUserId = 456;
  const testMapCreatedDate = "2023-01-19 03:14:07";

  const testMapData: SaveMapData = {
    map: {
      zoom: [8],
      lngLat: [0, 0],
      searchMarker: [0, 0],
      currentLocation: [0, 0],
    },
    drawings: {
      activeDrawing: "",
      polygonsDrawn: 0,
      linesDrawn: 0,
    },
    markers: {
      currentMarker: "",
      markersDrawn: 0,
    },
    mapLayers: {
      landDataLayers: [],
      myDataLayers: [],
      ownershipDisplay: "churchOfEngland",
    },
    version: "1.1",
  };

  beforeEach(() => {
    sandbox.replace(
      Model.Map,
      "findOne",
      fake.resolves({
        id: testMapId,
        created_date: testMapCreatedDate,
      })
    );
    sandbox.replace(query, "trackUserEvent", fake.resolves(null));
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("calls trackUserMapEvent when ownershipDisplay is enabled", async () => {
    const oldData = {
      ...testMapData,
      mapLayers: {
        ...testMapData.mapLayers,
        ownershipDisplay: null,
      },
    };
    const newData = {
      ...testMapData,
      mapLayers: {
        ...testMapData.mapLayers,
        ownershipDisplay: "localAuthority",
      },
    };

    await compareMapDataChangesAndSendAnalytics(
      testUserId,
      testMapId,
      oldData,
      newData
    );

    expect(query.trackUserEvent.calledOnce).to.be.true;
    const [, event, data] = (query.trackUserEvent as any).firstCall.args;

    expect(event).to.equal(Event.LAND_OWNERSHIP.ENABLE);
    expect(data.layer_id).to.equal("localAuthority");
  });

  it("calls trackUserMapEvent when ownershipDisplay is changed", async () => {
    const oldData = testMapData;
    const newData = {
      ...testMapData,
      mapLayers: {
        ...testMapData.mapLayers,
        ownershipDisplay: "localAuthority",
      },
    };

    await compareMapDataChangesAndSendAnalytics(
      testUserId,
      testMapId,
      oldData,
      newData
    );

    expect(query.trackUserEvent.calledOnce).to.be.true;
    const [, event, data] = (query.trackUserEvent as any).firstCall.args;

    expect(event).to.equal(Event.LAND_OWNERSHIP.ENABLE);
    expect(data.layer_id).to.equal("localAuthority");
  });

  it("does not call trackUserMapEvent when ownershipDisplay is disabled", () => {
    const oldData = testMapData;
    const newData = {
      ...testMapData,
      mapLayers: {
        ...testMapData.mapLayers,
        ownershipDisplay: null,
      },
    };

    compareMapDataChangesAndSendAnalytics(
      testUserId,
      testMapId,
      oldData,
      newData
    );

    expect(query.trackUserEvent.called).to.be.false;
  });

  it("does not call trackUserMapEvent when other map data changes", () => {
    const oldData = testMapData;
    const newData = {
      ...testMapData,
      mapLayers: {
        ...testMapData.mapLayers,
        landDataLayers: ["layer1", "layer2"],
        myDataLayers: ["dataGroup1", "dataGroup2"],
      },
      drawings: {
        ...testMapData.drawings,
        polygonsDrawn: 5,
        linesDrawn: 3,
      },
      markers: {
        ...testMapData.markers,
        markersDrawn: 10,
      },
    };

    compareMapDataChangesAndSendAnalytics(
      testUserId,
      testMapId,
      oldData,
      newData
    );

    expect(query.trackUserEvent.called).to.be.false;
  });
});
