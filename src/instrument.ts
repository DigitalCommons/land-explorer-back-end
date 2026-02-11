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
    host: "api-eu.mixpanel.com",
    geolocate: false,
    // debug: true,
  });
} else {
  console.warn("Mixpanel token not found. Analytics will not be sent.");
}

/** The list of events that can be tracked in the form of "<Category>_<Action>" */
export const Event = {
  LAND_OWNERSHIP: {
    ENABLE: "LandOwnership_Enable",
    SAVE_PROPERTY: "LandOwnership_SaveProperty",
    BACKSEARCH: "LandOwnership_Backsearch",
  },
  MAP: {
    FIRST_SAVE: "Map_FirstSave",
    OPEN: "Map_Open",
    EXPORT_SHAPEFILE: "Map_Export_Shapefile",
    EXPORT_GEOJSON: "Map_Export_GeoJSON",
    SHARE: "Map_Share",
    SHARED_OPEN: "Map_SharedOpen",
    GEOJSON_OPEN: "Map_GeoJsonOpen",
  },
  USER: {
    REGISTER: "User_Register",
    FEEDBACK: "User_Feedback",
  },
} as const;

// Recursively extract the union of values of the leaves of an object into a type
type LeafValues<T> = T extends object ? LeafValues<T[keyof T]> : T;

export type EventName = LeafValues<typeof Event>;

/**
 * You probably want to use trackUserEvent instead of this, for events where a user is logged in.
 */
export const trackRawEvent = (event: EventName, data?: any) => {
  console.log(`[ANALYTICS] ${event}`, data);

  mixpanel?.track(event, {
    ...data,
    ip: "0", // disable geolocation tracking since this doesn't make sense for server-side
  });
};
