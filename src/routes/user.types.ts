import { LoggedInRequest } from "./request_types";

type UpdateAnalyticsConsentPayload = {
  analyticsConsent: boolean;
};

export type UpdateAnalyticsConsentRequest = LoggedInRequest & {
  payload: UpdateAnalyticsConsentPayload;
};
