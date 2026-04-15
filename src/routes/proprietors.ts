import { ResponseToolkit, ResponseObject, ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { LoggedInRequest } from "./request_types";
import { searchProprietors } from "../queries/proprietors";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

type GetProprietorsRequest = LoggedInRequest & {
  query: {
    searchTerm: string;
    page: number;
    pageSize: number;
  };
};

/**
 * Handler for GET /api/proprietors. Proxies search request to the Property Boundaries Service and returns the response.
 * Forwards client aborts to the PBS request so that in-flight requests are not left running unnecessarily.
 * @param request - The incoming request, which includes query parameters for searchTerm, page, and pageSize.
 * @param h - The Hapi response toolkit for constructing responses.
 * @returns A response object containing the search results or an error message.
 */
async function getProprietors(
  request: GetProprietorsRequest,
  h: ResponseToolkit,
): Promise<ResponseObject> {
  const { searchTerm, page, pageSize } = request.query;

  const abortController = new AbortController();
  const onClose = () => abortController.abort();
  request.raw.req.on("close", onClose);

  try {
   // Forward client abort to PBS so in-flight requests are not left running
    const result = await searchProprietors(
      searchTerm,
      page,
      pageSize,
      abortController.signal,
    );
    return h.response(result).code(200);
  } catch (error) {
    if (abortController.signal.aborted) {
      return h.response().code(499);
    }
    console.error("Error in getProprietors:", error);
    return h.response("Internal server error").code(500);
  } finally {
    request.raw.req.off("close", onClose);
  }
}

export const proprietorRoutes: ServerRoute[] = [
  {
    method: "GET",
    path: "/api/proprietors",
    handler: getProprietors,
    options: {
      validate: {
        query: Joi.object({
          searchTerm: Joi.string().required(),
          page: Joi.number().integer().min(1).optional().default(DEFAULT_PAGE),
          pageSize: Joi.number()
            .integer()
            .min(1)
            .max(MAX_PAGE_SIZE)
            .optional()
            .default(DEFAULT_PAGE_SIZE),
        }),
        failAction: (request, h, err) =>
          h
            .response({ message: (err as Error).message })
            .code(400)
            .takeover(),
      },
    },
  },
];
