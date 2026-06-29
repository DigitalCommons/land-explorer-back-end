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

compose.all.yml at the root of this repo bring up everything with one command, all three repos and throwaway mysql and meilisearch. The three repos need to be checked out side by side to run it.

First download the secrets file docker.env from Bitwarden (named Land Explorer docker.env) and put it in this repo's root - or if you don't have Bitwarden access edit the docker.env.example and rename it to docker.env

Then from land-explorer-back-end run:

```
docker compose --env-file docker.env -f compose.all.yml up --build
```

`--env-file docker.env` is needed because the front-end's map keys are build args, which Compose only resolves from `--env-file` or the shell not from the env_file arg in the compose file.

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

The credentials inlined in compose.all.yml are dev throwaways. Real secrets - map keys, SendGrid, analytics, PBS pipeline keys - are in docker.env (from Bitwarden). The live secrets are injected by Coolify.

### Reset

MySQL and Meilisearch data is stored in named volumes (mysql_data and meilisearch_data) - to wipe the database and start clean drop the volumes:

```
docker compose --env-file docker.env  -f compose.all.yml down -v --remove-orphans
docker compose --env-file docker.env -f compose.all.yml up --build
```

## Rebuild

To rebuild, for example, just the back end, run:

```
docker compose --env-file docker.env -f compose.all.yml up --build lx-be
```

You can add `-d` to run in the background as well and use `docker logs` to inspect the logs.

### Env vars and secrets

There are two kinds of config:

- dev throwaways - inlined in compose.all.yml (DB host/user/password, dev `TOKEN_KEY`, `devsecret`). Nothing to do.
- real secrets - in `docker.env` (download from Bitwarden, see `docker.env.example`). The back-end and PBS load it at runtime via `env_file:`; the front-end map keys are build args fed by `--env-file docker.env`. Without keys the app and login work but the map won't render and emails won't send.

`.env.example` in each repo is the reference list of every variable and is what you copy to `.env` for *native* (non-Docker) dev - it is not read by the containers.

### Populating property data and proprietor search

When you start the containers fresh you will get an empty property_boundaries table and an empty Meilisearch index. Map and login work but Land Ownership layer and proprietor search return nothing until PBS pipeline runs.

At some point we should add a small set of test data or the ability to copy from an existing database.

To populate the data needed for these features run this optional one-shot docker service - it happens in lx-pbs and you can watch the logs to see progress:

```
docker compose --env-file docker.env -f compose.all.yml --profile seed up lx-pbs-seed
```

You can also trigger it manually:

```
curl 'http://localhost:24001/run-pipeline?secret=devsecret&startAtTask=ownerships'
```

For just meilisearch you need to trigger it via:

```
curl 'http://localhost:24001/run-pipeline?secret=devsecret&startAtTask=updateProprietors&stopBeforeTask=downloadInspire'
```

Two issues:

- It will take a **LONG TIME** - possibly several days and needs real GOV_API_* keys in docker.env - if you start it at updateProprietors instead it will re-index land_ownerships instead of starting from the beginning
- The downloadInspire task for the INSPIRE boundaries from https://use-land-property-data.service.gov.uk/datasets/inspire/download is failing - it is failing in the non-docker version - see https://github.com/DigitalCommons/property-boundaries-service/issues/45


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
