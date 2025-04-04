import * as Sentry from "@sentry/node";
import dotenv from "dotenv";

dotenv.config();

Sentry.init({
  dsn: `https://${process.env.GLITCHTIP_KEY}@app.glitchtip.com/10892`,
  environment: process.env.NODE_ENV,
});
