import * as Sentry from "@sentry/node";
import Mixpanel from "mixpanel";
import dotenv from "dotenv";

dotenv.config();

// For Glitchtip error reporting
Sentry.init({
  dsn: `https://${process.env.GLITCHTIP_KEY}@app.glitchtip.com/10892`,
  environment: process.env.NODE_ENV,
});

// For Mixpanel user analytics
let mixpanel: Mixpanel.Mixpanel;
if (process.env.MIXPANEL_TOKEN) {
  mixpanel = Mixpanel.init(process.env.MIXPANEL_TOKEN, {
    debug: process.env.NODE_ENV === "development",
  });
} else {
  console.warn("Mixpanel token not found. Analytics will not be sent.");
}

export enum EventCategory {
  DATA_GROUP = "DataGroup",
  LAND_OWNERSHIP = "LandOwnership",
  MAP = "Map",
  USER = "User",
}

export enum EventAction {
  // LandOwnership
  BACKSEARCH = "Backsearch",
  // Map
  SAVE = "Save",
}

export const trackEvent = (
  userHash: string,
  category: EventCategory,
  action: EventAction,
  data?: any
) => {
  const event = `${category}_${action}`;
  console.log(`[ANALYTICS] ${event}`, data);

  mixpanel?.track(event, {
    ...data,
    distinct_id: userHash,
    ip: "0", // disable geolocation tracking since this doesn't make sense for server-side
  });
};
