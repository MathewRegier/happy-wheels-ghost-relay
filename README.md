# Jimbob Maps and Happy Wheels Multiplayer relay

This repository now deploys the combined Maps catalogue, map publishing API, public `/maps` page and Multiplayer WebSocket relay. Players only need Multiplayer; map creators upload with Builder.

The launcher and mod SDK remain in [jhwml](https://github.com/MathewRegier/jhwml). Existing mod downloads remain in `mod-store/`; this backend deployment does not update those release archives.

## Railway deployment

Deploy the repository root using **Railpack**, with Config File `/railway.toml`. No Dockerfile is required. Remove the `RAILWAY_DOCKERFILE_PATH` variable and clear any Dockerfile-path override in Railway.

The build installs root relay dependencies and `maps-service` dependencies. Node.js 24 is required. The server starts with `node maps-service/server.cjs`, binds to `0.0.0.0` and Railway's `PORT`, and exposes `/api/maps/health` for healthchecks.

Configure the B2 credentials and publishing secret in Railway's Variables, never in this repository. `B2_ENDPOINT` must be a full HTTPS URL, such as `https://s3.us-east-005.backblazeb2.com`. Mount a persistent volume at `/data/jimbob-maps`, set `MAPS_DATA_DIR=/data/jimbob-maps`, and use one replica.

See [the complete Maps setup guide](maps-service/README.md) for the required variables, B2 application key setup, publishing and client connections. The healthcheck confirms startup; publishing and loading a test map separately verifies B2 access.

## Files

- `maps-service/`: validated publishing, catalogue, previews and private B2 storage.
- `relay/`: relay modules used by the combined server.
- `mods/jimbobs-multiplayer/web/course.js`: shared map marker parser; no game assets.
- Root `server.cjs`, `core.js`, and `shared-protocol.cjs`: existing relay-only entry point, retained for compatibility. `npm run start:relay-only` starts that entry point without Maps.
- `mod-store/` and `launcher/`: existing releases and review files.
