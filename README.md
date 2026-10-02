# Happy Wheels ghost racing relay

Backend-only WebSocket server for ghost racing. No game files. Push **this folder** to GitHub as the repo root, then deploy that repo on Railway.

The public launcher, SDK, and developer docs live in **[jhwml](https://github.com/MathewRegier/jhwml)** ([docs](https://mathewregier.github.io/jhwml/)). The [`launcher/`](launcher/README.md) folder in this relay repo is only a Nexus / GameBanana review slice. It is not used by Railway.

Friends connect with `wss://your-app.up.railway.app` in the game Multiplayer **Server settings**.

## 1. Put this folder on GitHub

The GitHub repo root must contain `package.json` and `server.cjs` from this folder. Do not upload the Happy Wheels game.

```powershell
cd relay
git init
git add .
git commit -m "Happy Wheels ghost racing relay"
```

Create an empty GitHub repo, then:

```powershell
git branch -M main
git remote add origin https://github.com/YOURNAME/YOUR-REPO.git
git push -u origin main
```

## 2. Deploy on Railway

1. Open [Railway](https://railway.app) and sign in with GitHub.
2. **New Project** → **Deploy from GitHub repo** → pick this repo.
3. Railway sets `PORT` for you. No other environment variables are required.
4. After it deploys, open the service and copy the public domain, such as `your-app.up.railway.app`.
5. Generate a domain under **Settings → Networking** if one is not shown yet.

Open `https://your-app.up.railway.app` in a browser. You should see:

```
Happy Wheels ghost racing relay
Stats: /stats
```

Public rooms are listed in the in-game browser through a separate short-lived WebSocket `browse` request (`lobby-directory-v1`). The response contains room names, host names, map titles, occupancy, mode, join availability and a password-required flag; never password hashes. Friends-only and older unlisted rooms are omitted. Public `/stats` also omits their codes and participants. A token-protected stats endpoint can show them to the server owner. Passwords use per-room random salts and scrypt hashes; room attempts are limited per socket and expensive hashing has a bounded relay-wide budget (4 concurrent, 8 per second). Hashing runs asynchronously so it does not block game messages. No client IP headers are trusted, and players behind Railway or a home router do not share an address cooldown. Joins revalidate occupancy and race state after hashing.
Optional lock: set `HW_RELAY_STATS_TOKEN` on Railway, then open `/stats?token=YOURTOKEN`.

## 3. Connect from the game

1. In Happy Wheels, open **Multiplayer → Server settings**.
2. Set the server address to:

```
wss://your-app.up.railway.app
```

Use `wss://`, not `ws://`. Railway is HTTPS.
3. Click **Save**.
4. Host creates a room. Share the room code. Joiners use the same `wss://` address and that code.

The first connection after idle time can take ~30 seconds if Railway slept the service.

## Local test

```powershell
npm install
npm start
```

Then connect the game to `ws://127.0.0.1:19799`.
