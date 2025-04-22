import { Request } from "@hapi/hapi";

// Define common request types

export type LoggedInRequest = Request & {
  auth: {
    credentials: {
      user_id: number;
    };
  };
};
