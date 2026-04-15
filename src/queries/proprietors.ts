import axios from "axios";

export type ProprietorSearchResponse = {
  results: { id: number; proprietorName: string }[];
  page: number;
  pageSize: number;
  totalResults: number;
};

/**
 * Search for proprietors by name in the Property Boundaries Service.
 *
 * @param searchTerm partial or full proprietor name to search for
 * @param page page number
 * @param pageSize number of results per page
 * @param signal optional AbortSignal to cancel the request
 */
export const searchProprietors = async (
  searchTerm: string,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
): Promise<ProprietorSearchResponse> => {
  const response = await axios.get(
    `${process.env.BOUNDARY_SERVICE_URL}/proprietors`,
    {
      params: {
        searchTerm,
        page,
        pageSize,
        secret: process.env.BOUNDARY_SERVICE_SECRET,
      },
      signal,
    },
  );
  return response.data;
};
