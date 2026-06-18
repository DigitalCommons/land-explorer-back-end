# Running LX in containers

Land Explorer code is in 3 git repos that are built into 3 Docker images:

- back-end - land-explorer-back-end - this repo - Node, Hapi, compiled to lib/
- front-end - land-explorer-front-end - caddy serving the built Vite SPA
- pbs - property-boundaries-service - Hapi ESM, compiled to dist/

They depend on two stateful services:

- mysql - two databases, land_explorer (back end) and property_boundaries (PBS)
- meilisearch - full text search, used by PBS and the back end

This documentation is about building and running through docker, see technology-and-infrastructure for details on how to deploy via Coolify.

## Quick start - whole stack on your local dev machine

compose.all.yml at the root of this repo bring up everything with one command, all three repos and throwaway mysql and meilisearch. The three repos need to be checked out side by side to run it then from land-explorer-back-end run:

```
docker compose -f compose.all.yml up --build
```

You will see logs in the console. The first time starting up migrations will take several minutes.

Open LX at http://localhost:28080

The host ports are deliberately uncommon so they don't clash with other things you might have running:

| Host port | Service (container) | Container port |
| --- | --- | --- |
| 28080 | Caddy - front-end for end users (lx-fe) | 80 |
| 24000 | Back-end API (lx-be) | 4000 |
| 24001 | PBS API (lx-pbs) | 4000 |
| 23306 | MySQL (lx-mysql) | 3306 |
| 27700 | Meilisearch (lx-meilisearch) | 7700 |

If you change the front-end or back-end host port, update the matching value:

- the back-end's `CORS_ORIGINS` (the front-end's browser origin)
- the front-end's `VITE_ROOT_URL` build arg (where the SPA calls the API).

The credentials in compose.all.yml are dev throwaways - the live (dev/staging/prod) secrets are injected by Coolify.

### Seeing the map

Tiles won't render without keys. Get those from bitwarden and run like this:

```
VITE_OS_KEY=... VITE_MAPBOX_TOKEN=... VITE_GEOCODER_TOKEN=... \
    docker compose -f compose.all.yml up --build
```

### Reset

MySQL and Meilisearch data is stored in named volumes (mysql_data and meilisearch_data) - to wipe and start clean:

```
docker compose -f compose.all.yml down -v
```

### Individual images

Each repo has a Dockerfile. They are multi stage (Node then runtime stage) and they all require NODE_VERSION to be passed explicity. For example to build the front end:

```
docker build \
--build-arg NODE_VERSION=24 \
--build-arg CADDY_HOSTNAME=app.landexplorer.coop \
--build-arg VITE_ROOT_URL=https://api.landexplorer.coop \
--build-arg VITE_OS_KEY=... \
--build-arg VITE_MAPBOX_TOKEN=... \
--build-arg VITE_GEOCODER_TOKEN=... \
-t lx-front-end land-explorer-front-end
```
### Runtime config

Unlike the front end the BE and PBS read config from runtime env variables. The full list lives in .env.example

### Database migrations

The images run the app, not migrations. Two one-shot services, lx-be-migrate and lx-pbs-migrate, run `npx sequelize-cli db:migrate` (against the lx-be and lx-pbs runtime images) before the back end and pbs start. This is the same migrate path Coolify uses via its pre-deploy command.
