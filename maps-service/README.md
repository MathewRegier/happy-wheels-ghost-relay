# Jimbob Maps — setup and operation

Jimbob Maps stores Happy Wheels level XML and optional PNG previews in your **private Backblaze B2 bucket**. This service provides the searchable catalogue, publishing API, public `/maps` website, and updated Multiplayer relay. A player needs **Multiplayer 0.7.0 or newer**, not Builder. Creators use **Builder 0.3.0** plus Multiplayer.

This repository includes the combined Maps and Multiplayer backend. Deploy the updated main branch to Railway to activate it. Server settings and B2 credentials remain in Railway Variables.

## 1. Create the B2 bucket and application key

In your existing B2 account:

1. Create a new **private** bucket, for example `jimbob-maps-yourname`. Use its exact bucket name below.
2. Copy the bucket's **S3 endpoint**, such as `https://s3.us-west-004.backblazeb2.com`. Use your actual region; do not copy the example blindly.
3. Create an application key restricted to this bucket with **Read and Write** access. You can additionally restrict its filename prefix to `blobs/`. Do not use the master application key. If the console offers **Allow List All Bucket Names**, enable it for S3 compatibility.
4. Keep the key ID and application key for the server's environment variables. Do not put them in the mod, game settings, screenshots, a public repository, or a chat message.

No public bucket access or browser CORS configuration is required: the service reads B2 privately and serves verified XML/previews to players.

Backblaze reference: [S3-compatible application keys](https://www.backblaze.com/docs/cloud-storage-s3-compatible-app-keys).

## 2. Deploy the supplied service package

Use `Jimbob-Maps-Service-1.0.0.zip` from this delivery. It contains the relay and map backend, **no Happy Wheels game files, publisher keys, local maps or test data**. Extract it into its own folder. The root railway.toml selects Railway's automatic Node.js build (Railpack), installs both dependency sets, and starts the combined Maps/relay server. No Dockerfile is required.

The easiest fit for your existing relay is Railway. You can deploy the extracted folder using the Railway CLI **without publishing to GitHub**:

```powershell
npx.cmd --yes @railway/cli login
npx.cmd --yes @railway/cli link
npx.cmd --yes @railway/cli up . --path-as-root
```

Run those commands inside the extracted folder. Choose the intended service when linking; deploying to the existing relay replaces its running backend and disconnects active rooms, so do it between matches. Alternatively, create a separate service for an initial test and use that service's address in Multiplayer. The CLI does not automatically create a public domain; generate one in Railway's Networking settings.

Before the first deployment, configure:

- **One service replica.** This version uses one SQLite catalogue and an in-memory room directory.
- **Persistent volume mounted at `/data/jimbob-maps`.** Without the volume, redeployment loses the catalogue even though XML remains in B2. This must be a runtime volume, not a build-time mount.
- **HTTPS public domain**, with WebSocket support. The same origin serves maps and the relay.
- **Healthcheck path:** `/api/maps/health`.
- Railway's `PORT` variable can override the default `19799`; expose that port through its public domain.

Add these variables in the service dashboard:

```text
B2_ENDPOINT=https://s3.YOUR-REGION.backblazeb2.com
B2_REGION=YOUR-REGION
B2_BUCKET=YOUR-PRIVATE-BUCKET
B2_KEY_ID=YOUR-RESTRICTED-KEY-ID
B2_APPLICATION_KEY=YOUR-RESTRICTED-APPLICATION-KEY
MAPS_PUBLISH_TOKEN=YOUR-OWN-RANDOM-PUBLISHING-SECRET
MAPS_AUTHOR=Jimbob
MAPS_DATA_DIR=/data/jimbob-maps
MAPS_TRUST_PROXY=1
```

Generate a separate publishing secret with Node.js on your own computer:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Use that value for `MAPS_PUBLISH_TOKEN` and in your own Builder. It must be at least 32 characters. **It is not a B2 key.** Never distribute it to players. Anyone holding it can publish/update maps on this service.

`MAPS_TRUST_PROXY=1` is appropriate only behind a controlled hosting proxy that replaces/appends the real client address to `X-Forwarded-For`. Leave it `0` when directly exposing the Node server. This avoids all players sharing the proxy's request allowance.

Do **not** set `MAPS_STORAGE=local` in production. That option is only for offline development; B2 is the default storage backend.

After deployment, verify:

1. `https://YOUR-DOMAIN/api/maps/health` returns `ok: true`.
2. `https://YOUR-DOMAIN/maps` opens the catalogue. It will initially be empty.
3. Publish a small test map from Builder. A successful publication verifies your actual B2 write configuration; loading that map from a fresh client verifies B2 reads. The healthcheck alone does not test B2 credentials.

Railway references: [Deploying local files](https://docs.railway.com/cli/up), [Persistent volumes](https://docs.railway.com/volumes).

## 3. Connect the game

Fully quit Happy Wheels and launch through Steam so the new native bridge loads.

In **Multiplayer → settings**, set the server address to:

```text
wss://YOUR-DOMAIN
```

The Maps service defaults to the HTTPS version of that same address. Leave the optional Maps address empty when using the combined service. If you use a separate origin for the map API, explicitly set `https://YOUR-MAPS-DOMAIN` on every client, and ensure the relay is configured against that same catalogue.

For your own computer, open an editor draft, then **Builder → Publish to Jimbob Maps**:

1. Expand **Publishing connection**.
2. Set the service address to `https://YOUR-DOMAIN`.
3. Enter `MAPS_PUBLISH_TOKEN`, then **Save connection**.
4. Enter a name and description. Choose **Public** or **Unlisted**.
5. Frame the editor and **Capture editor**, or **Choose PNG**. Preview is optional, at most 2048 × 2048 and 2 MB.
6. Save the draft in the native editor, then **Publish current draft**. Builder applies its current multiplayer options to the uploaded snapshot.

The result contains a `JM-...` map code. Public maps appear in **Choose a level → Jimbob Maps** and on the website. Unlisted maps are accessible by their code but do not appear publicly; this is not password-protected map storage.

Use **Refresh my maps**, choose an existing map, and publish to create a new revision. The original code remains the same. Existing rooms retain the old revision until the host selects the updated map. Old revisions remain available for consistent rematches.

## 4. Players and existing maps

Players install Multiplayer only, choose your updated server, join a lobby, and use the Jimbob Maps tab or a JM code. The supplied Multiplayer update ZIP includes a local installer that refreshes the native bridge. Extract it, close Happy Wheels, and run `python install-local.py` (Python 3.10+). Use `--game "YOUR-STEAM-GAME-FOLDER"` for a different Steam library. It requires the existing JHWML loader, makes verified backups, and rolls back on failure. Builder has its own separate update ZIP. Do not run an older launcher install afterward if it would downgrade the installed mod. Your Steam copy already has this update installed. They download the verified XML before entering the normal character-selection/ready barrier. There is no need to open the editor or install Builder on clients.

Official Happy Wheels levels and private Builder draft testing retain their existing paths. Hosted maps do not use the official upload limit or require `JHWMP` in their title. Multiplayer marker tags still work: spawn positions, mirrored facing, fixed camera, survival, checkpoint/retry and other course options are retained in the XML.

This platform supports normal Happy Wheels XML using game-provided assets. It does not bundle additional character mods or external game assets; players still need a separate custom-character mod when choosing a custom character.

For a first multiplayer check:

1. Publish a two-spawn survival draft and confirm the catalogue preview/rules.
2. Join from a second window or computer with **Builder disabled**.
3. Ready up, select characters when allowed, and confirm both players see the same map and their assigned spawn/facing/camera.
4. Eliminate one player; verify results. Try a unanimous restart vote, then Race Again, then Back to lobby.
5. Switch to an official level and back to the hosted map. Publish an update while a room remains on revision 1; the room should retain revision 1 until selecting the update.

## Storage, limits and recovery

- XML is limited to **16 MB**, uploads including preview to **20 MB**, and XML nesting/object counts are bounded. Map contents are validated in a worker thread so parsing a complex map does not monopolize the relay's event loop.
- Clients keep a **256 MB** XML cache. Every launch resolves the pinned descriptor; cached XML is hashed and corrupt files are downloaded again. The service coalesces identical downloads and holds up to **64 MB** of hot blobs.
- Publish retries are idempotent. B2 failure does not create a visible partial map. Editing a stale revision is rejected with a refresh message.
- Downloads use B2 → service → player. Your B2 storage/download allowances and hosting bandwidth billing apply. This delivery does not configure a Cloudflare CDN or claim free unlimited egress.
- Do not expire current content-addressed B2 XML/PNG objects with a lifecycle rule. Old revisions may still be used by active rooms. Repeated identical B2 PUTs can create prior B2 versions; a policy deleting **superseded versions only** can reduce storage while retaining the latest object at each key.
- Back up the persistent catalogue volume as well as B2. For a simple consistent backup, stop the service and copy the entire `/data/jimbob-maps` directory, including any SQLite WAL/SHM files, before restarting. Configure your provider's volume backup facility too.
- To move hosts, retain the B2 bucket and restore the entire catalogue directory. Do not recreate an empty catalogue over an existing deployment.
- To rotate the publishing secret, update the server variable, restart the service and replace the saved key in Builder. Player configuration does not contain that secret. Windows safeStorage protects the saved key; if encryption is unavailable, it is kept only in memory for that run.

If a player sees “relay needs Jimbob Maps”, their selected relay has not been updated. If downloads fail, check that their Maps origin points to the same catalogue as the room, then verify B2 read access. If characters are still loading, return to the lobby and retry; failed or cancelled downloads cannot release the start barrier into a different map.

## Local development

Install Node.js 24 or newer. From the package root:

```powershell
npm ci
npm --prefix maps-service ci
$env:MAPS_STORAGE='local'
$env:MAPS_DATA_DIR='./maps-service/data'
$env:MAPS_PUBLISH_TOKEN='YOUR-LOCAL-RANDOM-SECRET-AT-LEAST-32-CHARACTERS'
$env:HOST='127.0.0.1'
node maps-service/server.cjs
```

Use `ws://127.0.0.1:19799` in Multiplayer and `http://127.0.0.1:19799` in Builder. Loopback HTTP is intentionally allowed for local testing; public servers require HTTPS/WSS. For tests in the full development workspace, run `node --test tests/*.test.cjs` and `node --test maps-service/tests/*.test.cjs`.

Railway builds from the combined package root using Railpack and Node.js 24. The build command installs the root relay dependencies and the maps-service dependencies. Do not set the service root to maps-service alone; it needs sibling relay and course modules.

## Delivery verification

Automated coverage includes the native XML interception, Multiplayer-only dependency path, map identity/revision validation, authenticated publishing, storage failure/retry, cache corruption repair, proxy request budgets, old-client rejection, stale map choices, preparation barriers, Ghost/Shared survival results and unanimous restarts. Tests use local object storage and mock B2 SDK requests. The public deployment must be verified after you complete the setup above; the current local B2 connection has been verified separately.

Local delivery checks completed: **294 Multiplayer regression checks + 13 Maps/backend checks**, both local update installers, native-patch failure rollback, and startup/publication/download from the extracted service ZIP. Before the latest foreground/finish patch, two native game windows exercised a hosted two-spawn survival map in Shared Physics and Ghost; results, unanimous restart voting, returning to lobby, and pinned-revision replay produced no captured mod errors. Your Steam mods/native bridge were backed up and installed. Temporary service and test windows were closed, and your previous Maps address was restored.

The latest local patch additionally tests replicated foreground opacity/visibility/deletion, camera culling isolation, retired visual objects, custom goal precedence, finish detection after host death, and one-time finish reporting. A real WebSocket relay test confirms that guest and host can both finish a normal Shared Physics race and receive matching results. These are automated checks; restart both native game windows to verify your affected maps interactively. Both players need the updated Multiplayer files for foreground synchronization. Finish reporting uses the existing relay finish protocol, and the scene field is optional and forwarded by the existing authority-v3 relay; these client fixes do not require a Railway deployment.

The B2 integration has SDK request tests, and the current local service has also passed a real XML/PNG publish and download check using the configured bucket. The extracted Node service was run successfully. Railway uses an automatic Node build; its remote build must be verified after deployment. This is a single-server catalogue/relay; horizontal replication requires a later shared database/room-directory design.

## Local port conflicts

If publishing reports “Unexpected token H, Happy Whee…” or “did not return the Jimbob Maps API”, Builder has reached an older relay instead of the Maps service. Check `/api/maps/health`: a Maps service returns JSON with `protocol: jimbob-maps-v1`; the older relay replies with plain text. If port 19799 is occupied by that relay or a Builder draft test, set `PORT=19798` in your local `maps-service/.env` and start `node --env-file=.env server.cjs` from the maps-service folder. Set Builder publishing connection to `http://127.0.0.1:19798` and Multiplayer server to `ws://127.0.0.1:19798`. The publishing key must match your local `MAPS_PUBLISH_TOKEN`. Ports can differ between local testing and Railway; use your deployed HTTPS/WSS origin for public play.

If the server reports that a Backblaze upload was blocked by network permissions, its process cannot make outbound HTTPS requests. Run the local server from a normal terminal with network access, or grant that access to the agent-started server. Testing B2 from a different process does not prove that the running Maps service has outbound access. The development instance was verified through its publishing API with real B2 XML/PNG uploads, readback, and cleanup of only the temporary unlisted test map.

For the current local setup, **Test localhost** now sets both **Server** `ws://127.0.0.1:19798` and **Jimbob Maps address** `http://127.0.0.1:19798` in Multiplayer connection settings, including the native saved Maps connection. Builder publishing uses the same HTTP address. Start the local Maps service on port 19798 before connecting. Map browsing does not require a publishing key.

After installing a native Maps client update, save any editor draft, fully quit all Happy Wheels windows, and launch again through Steam. A running game keeps the previous native client in memory; replacing the file on disk cannot update that process. Multiplayer now reads the Maps address saved by Builder, preserves saved local relay addresses, and waits for the native settings read before saving, preventing a stale blank field from erasing the connection. Only run one service on port 19798; if it is already healthy, starting another copy causes EADDRINUSE.


### October 4 local gameplay patch

Balcony Terror's allocation failures were reproduced in two native windows. Native character painting could re-enter roster preparation before the remote rig was registered, repeatedly allocating bodies. Preparation now prevents that re-entry and keeps failed rigs unprepared. Pair and proxy storage can grow per world without changing collision filtering, and expanded proxies retain correct timestamp resets. Santa's extra array-backed bodies now have stable ownership and part keys, preventing mixed-character map-signature mismatches.

The completed native check used Dad/Moped, Segway/Dad, Explorer/Santa and Pogo/Helicopter through repeated lobby returns: both windows ran snapshots without captured mod errors. A separate local survival draft verified all seven tag labels hidden on both windows, unchanged distinct spawn coordinates and survival settings, a native neck-break death producing results, and clicking the host's Back to lobby button returning both windows to the lobby with no remaining shared actors. No hosted files or GitHub changes were published. All participating game processes must restart to load this client patch.


### Client finish flags and cleaner HUD (October 4)

Shared Physics now checks published/editor FinishLine objects retained in the native level keepVector as well as built-in endBlock finish regions. Each living rider is checked independently; custom goals and survival retain their own completion rules. Guest completion mutates the native getter-only replayData object instead of replacing it. Routine Shared Physics HUD labels are hidden; actionable errors and host-connection stalls remain visible.

Validation: 294/294 Multiplayer regression checks pass. In two fresh native Steam game windows, the Irresponsible Dad guest reached a real editor finish flag first, received completion without a replication error, and placed first on both results screens when the host subsequently finished. Routine status labels remained hidden. Installed files were backed up and their hashes verified. No relay change or GitHub publication is required.


The level picker now has Featured, Custom maps, and Multiplayer Maps. Multiplayer Maps is the hosted Jimbob Maps catalog, including previews, JM codes, rules and verified downloads. The legacy JHWMP catalog tab is removed; official maps remain available in Custom maps.


### Railway automatic Node build

Deploy the combined package root containing package.json, railway.toml, maps-service/server.cjs, relay/server.cjs, and mods/jimbobs-multiplayer/web/course.js. The configuration selects Railpack, pins Node.js 24 through the root package.json, installs both dependency sets, and starts node maps-service/server.cjs. Dockerfile requirements have been removed.

For GitHub deployment, include the root railway.toml and updated package.json/package-lock.json in your repository along with the backend files. In Railway use Root Directory `/` and Config File `/railway.toml` when those files are at the repository root. If the combined package is nested in the repository, select that containing folder as Root Directory and use its absolute railway.toml path. Do not deploy relay or maps-service alone.

Delete the RAILWAY_DOCKERFILE_PATH variable and clear any Dockerfile-path override. Select Railpack as Builder. Keep the existing B2 variables, publishing token, and volume mounted at /data/jimbob-maps. B2_ENDPOINT must be a full HTTPS URL, for example https://s3.us-east-005.backblazeb2.com. The healthcheck remains /api/maps/health. Environment variables stay in Railway, not the repository.

For a direct local upload, use the prepared standalone folder:

```powershell
Set-Location 'C:\Users\matfl\Documents\Codex\Jimbob-Maps-Railway'
npx.cmd --yes @railway/cli login
npx.cmd --yes @railway/cli link
npx.cmd --yes @railway/cli up . --path-as-root
```

The runtime should log `Jimbob Maps + Multiplayer listening on port ...`. Local uploads do not publish to GitHub. Restarting an old snapshot does not upload changed local files.
