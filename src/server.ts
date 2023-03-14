'use strict';

import Hapi from "@hapi/hapi";
import { Request, Server } from "@hapi/hapi";
import { databaseRoutes } from "./routes/database";
import { emailRoutes } from "./routes/emails";
import { mapRoutes } from "./routes/maps";
import { dataGroupRoutes } from "./routes/datagroups";

const AuthBearer = require('hapi-auth-bearer-token');
const Inert = require('@hapi/inert');
const jwt = require("jsonwebtoken");

export let server: Server;

function index(request: Request): string {
    console.log("Processing request", request.info.id);
    return "Hello! Nice to have met you...";
}

export const init = async function (): Promise<Server> {
    server = Hapi.server({
        port: process.env.PORT || 4000,
        host: '0.0.0.0',
        debug: { log: ['error'], request: ['error'] },
    });

    await server.register(AuthBearer);
    await server.register(Inert);

    server.auth.strategy('simple', 'bearer-access-token', {
        allowQueryToken: true,              // optional, false by default
        validate: async (request: any, token: string, h: any) => {
            let isValid = false;
            let credentials = {};

            try {
                // see the loginUser function to see token content
                const decodedToken = jwt.verify(token, process.env.TOKEN_KEY);

                isValid = true
                credentials = { user_id: decodedToken.user_id };
            } catch (err) {
                console.log("Failed authentication", err);
            }

            return { isValid, credentials };
        }
    });

    server.auth.default('simple');

    server.route({
        method: "GET",
        path: "/",
        handler: index,
        options: {
            auth: false
        }
    });

    server.route(databaseRoutes);
    server.route(mapRoutes);
    server.route(dataGroupRoutes);
    server.route(emailRoutes);

    // Log requests and response codes
    server.events.on('response', (request: any) => {
        console.log(request.info.remoteAddress + ': ' + request.method.toUpperCase() + ' ' + request.path + ' --> ' + request.response.statusCode);
    });

    return server;
};

export const start = async function (): Promise<void> {
    console.log(`Listening on ${server.settings.host}:${server.settings.port}`);
    return server.start();
};

process.on('unhandledRejection', (err) => {
    console.error("unhandledRejection");
    console.error(err);
    process.exit(1);
});
