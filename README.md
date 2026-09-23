# Happy Wheels ghost racing relay

Backend-only WebSocket server for ghost racing. No game files. Push **this folder** to GitHub as the repo root, then deploy that repo on Railway.

Launcher source (run from Python or build the EXE) lives in [`launcher/`](launcher/README.md). That folder is for Nexus / GameBanana review. It is not used by Railway.

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
```

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
