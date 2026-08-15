# CCR BOT MD v6.9

WhatsApp bot built with Baileys (@whiskeysockets/baileys).

## 🚀 Deploy on Railway (5 minutes)

### Step 1: Push to GitHub
```bash
cd whatsapp-bot
git init
git add .
git commit -m "CCR BOT MD v6.9"
```
Create a new repo on [GitHub](https://github.com/new) and push:
```bash
git remote add origin https://github.com/YOURUSERNAME/ccr-bot-md.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy on Railway
1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `ccr-bot-md` repo
4. Railway auto-detects Node.js and installs deps
5. Click **Deploy**

### Step 3: Pair your WhatsApp
1. Once deployed, go to the **Deployments** tab
2. Click on the active deployment → **Logs**
3. Look for the QR code in the logs (printed as ASCII art)
4. Open WhatsApp → **Settings** → **Linked Devices** → **Link a Device**
5. Scan the QR code from the logs

### Step 4: Add a Volume (IMPORTANT for persistence)
> Without this, your WhatsApp session is lost on every redeploy!
1. In Railway, go to **Settings** → **Volumes**
2. Add a volume mounted at `/app/auth_info_baileys`
3. Redeploy

### Environment Variables (optional)
Set these in Railway → Variables tab:
| Variable | Default | Description |
|---|---|---|
| `PORT` | 3000 | Railway sets this automatically |
| `NODE_ENV` | production | Node environment |

## Quick Start (Local)

```bash
npm install
npm start
```

Scan the QR code with WhatsApp.

## Features (60+ commands)

| Category | Commands |
|---|---|
| **Main** | menu, alive, ping, runtime, owner, info, help |
| **Economy** | wallet, bank, daily, work, crime, hunt, fish, mine, deposit, withdraw, transfer, leaderboard |
| **Group** | kick, promote, demote, tagall, hidetag, grouplink, setname, setdesc, groupinfo |
| **Protection** | antilink, antifwd, antibadword, antispam, flood, antipromote, antidemote |
| **Tools** | sticker, toimg, translate, ttp, attp, yts, google, weather, quote, joke, fact |
| **Fun** | 8ball, flip, dice, rps, guess |
| **Owner** | setprefix, setbotname, mode, broadcast, shutdown |

## Configuration

Edit `config` in `index.js`:
```js
const config = {
  prefix: '.',              // Command prefix
  owner: '26776544470',     // Your phone number (no +)
  botName: 'CCR BOT MD',
  version: 'v6.9',
  mode: 'public'            // 'public' or 'private'
};
```

## Deploy on VPS (Ubuntu + PM2)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
git clone <your-repo> && cd ccr-bot-md
npm install
sudo npm install -g pm2
pm2 start index.js --name ccr-bot
pm2 startup && pm2 save
```

## ⚠️ Important

- Baileys is an **unofficial** WhatsApp API. Use at your own risk.
- WhatsApp may ban numbers using unofficial clients. **Use a secondary number.**
- The auth session is saved in `auth_info_baileys/` — keep it safe and persistent.
- Economy data is in-memory (resets on restart). For persistence, add a database.
