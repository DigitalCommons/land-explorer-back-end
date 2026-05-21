import { LoggedInRequest } from "./request_types";

type UpdateUserGuidePromptSeenPayload = {
  userGuidePromptSeen: boolean;
  viewedUserGuide: boolean;
  viewedSource?: string;
};

export type UpdateUserGuidePromptSeenRequest = LoggedInRequest & {
  payload: UpdateUserGuidePromptSeenPayload;
};

type UpdateAnalyticsConsentPayload = {
  analyticsConsent: boolean;
};

export type UpdateAnalyticsConsentRequest = LoggedInRequest & {
  payload: UpdateAnalyticsConsentPayload;
};
