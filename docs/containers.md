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

Open http://localhost:8080

The services running when the containers come up are:

| Port | Service |
| 8080 | Caddy - front-end reverse proxy for end users |
| 4000 | Back-end API |
| 4001 | PBS API |
| 3306 | MySQL |
| 7700 | Meilisearch |

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

The images run the app, not migrations. There is a back-end-migrate service that runs `npx sequelize-cli db:migrate` before the app starts.
