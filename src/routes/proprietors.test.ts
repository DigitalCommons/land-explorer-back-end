import { expect } from "chai";
import { createSandbox, fake } from "sinon";
import { Server } from "@hapi/hapi";
import { init } from "../server";
import { ProprietorSearchResponse } from "../queries/proprietors";

// Dependencies to be stubbed
const proprietors = require("../queries/proprietors");

const sandbox = createSandbox();

describe("GET /api/proprietors", () => {
  let server: Server;

  const validRequest = {
    method: "GET",
    url: "/api/proprietors?searchTerm=Cambridge&page=1&pageSize=10",
    auth: {
      strategy: "simple",
      credentials: {
        user_id: 123,
      },
    },
  };

  const pbsResponse: ProprietorSearchResponse = {
    results: [
      { id: "1", proprietorName: "Cambridge Council" },
      { id: "2", proprietorName: "Cambridge City Council" },
    ],
    page: 1,
    pageSize: 10,
    totalResults: 2,
  };

  beforeEach(async () => {
    server = await init();
  });

  afterEach(async () => {
    await server.stop();
    sandbox.restore();
  });

  context("valid request", () => {
    beforeEach(() => {
      sandbox.replace(
        proprietors,
        "searchProprietors",
        fake.resolves(pbsResponse),
      );
    });

    it("returns status 200", async () => {
      const res = await server.inject(validRequest);

      expect(res.statusCode).to.equal(200);
    });

    it("returns the PBS response", async () => {
      const res = await server.inject(validRequest);

      expect(res.result).to.deep.equal(pbsResponse);
    });
  });

  context("missing searchTerm", () => {
    it("returns status 400", async () => {
      const res = await server.inject({
        ...validRequest,
        url: "/api/proprietors?page=1&pageSize=10",
      });

      expect(res.statusCode).to.equal(400);
      expect(res.result)
        .to.have.property("message")
        .that.includes('"searchTerm" is required');
    });
  });

    context("empty searchTerm", () => {
      it("returns status 400", async () => {
        const res = await server.inject({
          ...validRequest,
          url: "/api/proprietors?searchTerm=&page=1&pageSize=10",
        });

        expect(res.statusCode).to.equal(400);
        expect(res.result)
          .to.have.property("message")
          .that.includes('"searchTerm" is not allowed to be empty');
      });
    });

    context("searchTerm exceeds maximum length", () => {
      it("returns status 400", async () => {
        const longSearchTerm = "a".repeat(201);
        const res = await server.inject({
          ...validRequest,
          url: `/api/proprietors?searchTerm=${longSearchTerm}&page=1&pageSize=10`,
        });

        expect(res.statusCode).to.equal(400);
        expect(res.result)
          .to.have.property("message")
          .that.includes(
            '"searchTerm" length must be less than or equal to 200',
          );
      });
    });

  context("missing page (uses default)", () => {
    it("returns status 200", async () => {
      const stub = fake.resolves(pbsResponse);
      sandbox.replace(proprietors, "searchProprietors", stub);

      const res = await server.inject({
        ...validRequest,
        url: "/api/proprietors?searchTerm=Cambridge&pageSize=10",
      });

      expect(res.statusCode).to.equal(200);
      expect(stub.firstCall.args[1]).to.equal(1); // Verify default page is passed to PBS
      expect(res.result).to.have.property("page").that.equal(1); // Default page is 1
    });
  });

   context("non-integer page", () => {
     it("returns status 400", async () => {
       const res = await server.inject({
         ...validRequest,
         url: "/api/proprietors?searchTerm=Cambridge&page=abc&pageSize=10",
       });

       expect(res.statusCode).to.equal(400);
       expect(res.result)
         .to.have.property("message")
         .that.includes('"page" must be a number');
     });
   });

  context("page less than 1", () => {
    it("returns status 400", async () => {
      const res = await server.inject({
        ...validRequest,
        url: "/api/proprietors?searchTerm=Cambridge&page=0&pageSize=10",
      });

      expect(res.statusCode).to.equal(400);
      expect(res.result)
        .to.have.property("message")
        .that.includes('"page" must be greater than or equal to 1');
    });
  });

  context("missing pageSize (uses default)", () => {
    it("returns status 200", async () => {
      const stub = fake.resolves(pbsResponse);
      sandbox.replace(proprietors, "searchProprietors", stub);
      const res = await server.inject({
        ...validRequest,
        url: "/api/proprietors?searchTerm=Cambridge&page=1",
      });

      expect(res.statusCode).to.equal(200);
      expect(stub.firstCall.args[2]).to.equal(10); // Verify default pageSize is passed to PBS
      expect(res.result).to.have.property("pageSize").that.equal(10); // Default pageSize is 10
    });
  });

  context("non-integer pageSize", () => {
    it("returns status 400", async () => {
      const res = await server.inject({
        ...validRequest,
        url: "/api/proprietors?searchTerm=Cambridge&page=1&pageSize=abc",
      });

      expect(res.statusCode).to.equal(400);
      expect(res.result)
        .to.have.property("message")
        .that.includes('"pageSize" must be a number');
    });
  });

  context("pageSize less than 1", () => {
    it("returns status 400", async () => {
      const res = await server.inject({
        ...validRequest,
        url: "/api/proprietors?searchTerm=Cambridge&page=1&pageSize=0",
      });

      expect(res.statusCode).to.equal(400);
      expect(res.result)
        .to.have.property("message")
        .that.includes('"pageSize" must be greater than or equal to 1');
    });
  });

  context("pageSize exceeds maximum", () => {
    it("returns status 400", async () => {
      const res = await server.inject({
        ...validRequest,
        url: "/api/proprietors?searchTerm=Cambridge&page=1&pageSize=101",
      });

      expect(res.statusCode).to.equal(400);
      expect(res.result)
        .to.have.property("message")
        .that.includes('"pageSize" must be less than or equal to 100');
    });
  });

  context("arguments passed to PBS", () => {
    it("forwards searchTerm, page and pageSize from the request", async () => {
      const stub = fake.resolves(pbsResponse);
      sandbox.replace(proprietors, "searchProprietors", stub);

      await server.inject({
        ...validRequest,
        url: "/api/proprietors?searchTerm=Test+Council&page=3&pageSize=25",
      });

      expect(stub.calledOnce).to.be.true;
      expect(stub.firstCall.args[0]).to.equal("Test Council");
      expect(stub.firstCall.args[1]).to.equal(3);
      expect(stub.firstCall.args[2]).to.equal(25);
    });
  });

  context("unauthenticated request", () => {
    it("returns status 401", async () => {
      const res = await server.inject({
        method: "GET",
        url: "/api/proprietors?searchTerm=Cambridge&page=1&pageSize=10",
      });

      expect(res.statusCode).to.equal(401);
      expect(res.result)
        .to.have.property("message")
        .that.includes("Missing authentication");
    });
  });

  context("PBS throws an error", () => {
    it("returns status 500", async () => {
      sandbox.replace(
        proprietors,
        "searchProprietors",
        fake.rejects(new Error("PBS unavailable")),
      );
      const res = await server.inject(validRequest);

      expect(res.statusCode).to.equal(500);
    });
  });

  context("client disconnects during request", () => {
    it("returns status 499", async () => {
      let capturedRawReq: any;

      server.ext("onPreHandler", (request: any, h: any) => {
        capturedRawReq = request.raw.req;
        return h.continue;
      });

      sandbox.replace(
        proprietors,
        "searchProprietors",
        (
          _searchTerm: string,
          _page: number,
          _pageSize: number,
          signal?: AbortSignal,
        ) =>
          new Promise<never>((_resolve, reject) => {
            signal?.addEventListener("abort", () => {
              reject(new Error("Request aborted"));
            });
            // Simulate the client closing the connection. setImmediate defers
            // until after the handler has attached its own "close" listener.
            setImmediate(() => capturedRawReq.emit("close"));
          }),
      );

      const res = await server.inject(validRequest);
      expect(res.statusCode).to.equal(499);
    });
  });
});
