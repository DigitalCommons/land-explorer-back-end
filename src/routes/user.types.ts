import { LoggedInRequest } from "./request_types";

type UpdateAnalyticsConsentPayload = {
  analyticsConsent: boolean;
};

export type UpdateAnalyticsConsentRequest = LoggedInRequest & {
  payload: UpdateAnalyticsConsentPayload;
};

type UpdateUserGuidePromptSeenPayload = {
  userGuidePromptSeen: boolean;
  viewedUserGuide: boolean;
  viewedSource?: string;
};

export type UpdateUserGuidePromptSeenRequest = LoggedInRequest & {
  payload: UpdateUserGuidePromptSeenPayload;
};
