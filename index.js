// ============================================================
//  CCR BOT MD - v6.9
//  Complete WhatsApp Bot powered by Baileys
//  Owner: Clarence Rajah (+267 76 544 470)
// ============================================================

const http = require('http');

const {
  makeWASocket,
  fetchLatestBaileysVersion,
  DisconnectReason,
  useMultiFileAuthState,
  downloadMediaMessage,

} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const { default: translate } = require('@vitalets/google-translate-api');
const yts = require('yt-search');
const moment = require('moment');
const CryptoJS = require('crypto-js');

// ===== CONFIG =====
const AUTH_DIR = path.join(__dirname, 'auth_info_baileys');
const LOG_LEVEL = pino({ level: 'silent' });

const config = {
  prefix: '.',
  owner: '26776544470',
  botName: 'CCR BOT MD',
  version: 'v6.9',
  mode: 'public',
  thumb: 'https://telegra.ph/file/d9e3a1c4f1e1c1c1c1c1c.png'
};

let startTime = Date.now();
let store = null;


// ===== GLOBAL ERROR HANDLERS (prevent crashes) =====
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection:', reason?.output?.payload?.message || reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err?.message || err);
  // Don't crash - just log
});

// ===== SYSTEM CONTROLS =====
let protection = {
  antilink: { status: 'off' },
  antifwd: { status: 'off' },
  antibot: { status: 'off' },
  antigroupmention: { status: 'off' },
  antispam: { status: 'off' },
  antitag: { status: 'off' },
  antibadword: { status: 'off' },
  antipromote: { status: 'off' },
  antidemote: { status: 'off' },
  flood: { status: 'off' }
};

let antibad = {
  words: [
    'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'pussy',
    'spam', 'idiot', 'retard', 'wanker', 'motherfucker'
  ]
};

// ===== ECONOMY SYSTEM =====
let ecoSettings = { on: true };
let economyDB = {};

function getEcoUser(jid) {
  if (!economyDB[jid]) {
    economyDB[jid] = {
      wallet: 100,
      bank: 0,
      level: 1,
      xp: 0,
      inventory: [],
      lastDaily: 0,
      lastWork: 0,
      lastCrime: 0,
      lastHunt: 0,
      lastFish: 0,
      lastMine: 0
    };
  }
  return economyDB[jid];
}

function ecoLevelUp(jid, sock, chat) {
  const user = getEcoUser(jid);
  let needed = user.level * 100;
  while (user.xp >= needed) {
    user.xp -= needed;
    user.level++;
    needed = user.level * 100;
    sock.sendMessage(chat, {
      text: `🎉 *@${jid.split('@')[0]}* leveled up to **Level ${user.level}**!`,
      mentions: [jid]
    });
  }
}

// ===== SPAM/FLOOD TRACKING =====
let spamTracker = {};
let floodTracker = {};

// ===== HELPER FUNCTIONS =====

function isOwner(sender) {
  return sender.split('@')[0] === config.owner;
}

function getRuntime() {
  let runtime = Math.floor((Date.now() - startTime) / 1000);
  let d = Math.floor(runtime / 86400);
  let h = Math.floor((runtime % 86400) / 3600);
  let m = Math.floor((runtime % 3600) / 60);
  let s = runtime % 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

async function getHeader(sock, chat, sender) {
  let botNumber = sock.user.id.split(':')[0];
  let groupName = 'Private Chat';
  if (chat.endsWith('@g.us')) {
    try {
      let metadata = await sock.groupMetadata(chat);
      groupName = metadata.subject;
    } catch {}
  }
  let runtime = getRuntime();
  return (
    `╭✰ ${config.botName}\n` +
    `┃ 📱 Version: ${config.version}\n` +
    `┃ 👑 Owner: +${config.owner}\n` +
    `┃ 👤 User: ${sender.split('@')[0]}\n` +
    `┃ 🤖 Bot: +${botNumber}\n` +
    `┃ ⏰ Runtime: ${runtime}\n` +
    `┃ 🔧 Mode: ${config.mode.toUpperCase()}\n` +
    `┃ 📝 Prefix: (${config.prefix})\n` +
    `┃ 👥 Status: ${groupName}\n` +
    `┃\n╰✰`
  );
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatMoney(n) {
  return n.toLocaleString() + ' 🪙';
}

// Check if message contains a group link
function containsLink(text) {
  const linkRegex = /(https?:\/\/)?(www\.)?(chat\.whatsapp\.com|whatsapp\.com|t\.me|telegram\.me|youtube\.com|discord\.gg|facebook\.com|instagram\.com|tiktok\.com)/i;
  return linkRegex.test(text);
}

// ===== COMMAND LIST =====
const commands = {
  menu: { desc: 'Show bot menu', category: 'main', usage: '.menu' },
  alive: { desc: 'Check if bot is alive', category: 'main', usage: '.alive' },
  ping: { desc: 'Bot response speed', category: 'main', usage: '.ping' },
  runtime: { desc: 'Show bot uptime', category: 'main', usage: '.runtime' },
  owner: { desc: 'Show owner info', category: 'main', usage: '.owner' },
  info: { desc: 'Bot info', category: 'main', usage: '.info' },
  help: { desc: 'Get help', category: 'main', usage: '.help [command]' },
  // Economy
  wallet: { desc: 'Check wallet balance', category: 'economy', usage: '.wallet' },
  bank: { desc: 'Check bank balance', category: 'economy', usage: '.bank' },
  daily: { desc: 'Claim daily reward', category: 'economy', usage: '.daily' },
  work: { desc: 'Work for coins', category: 'economy', usage: '.work' },
  crime: { desc: 'Commit a crime (risky)', category: 'economy', usage: '.crime' },
  hunt: { desc: 'Hunt for coins', category: 'economy', usage: '.hunt' },
  fish: { desc: 'Fish for coins', category: 'economy', usage: '.fish' },
  mine: { desc: 'Mine for coins', category: 'economy', usage: '.mine' },
  deposit: { desc: 'Deposit to bank', category: 'economy', usage: '.deposit <amount>' },
  withdraw: { desc: 'Withdraw from bank', category: 'economy', usage: '.withdraw <amount>' },
  transfer: { desc: 'Transfer coins', category: 'economy', usage: '.transfer @user <amount>' },
  leaderboard: { desc: 'Top richest', category: 'economy', usage: '.leaderboard' },
  // Group
  kick: { desc: 'Kick member', category: 'group', usage: '.kick @user' },
  promote: { desc: 'Promote to admin', category: 'group', usage: '.promote @user' },
  demote: { desc: 'Demote admin', category: 'group', usage: '.demote @user' },
  tagall: { desc: 'Tag everyone', category: 'group', usage: '.tagall' },
  hidetag: { desc: 'Hidden tag', category: 'group', usage: '.hidetag <text>' },
  grouplink: { desc: 'Get group invite link', category: 'group', usage: '.grouplink' },
  setname: { desc: 'Set group name', category: 'group', usage: '.setname <name>' },
  setdesc: { desc: 'Set group description', category: 'group', usage: '.setdesc <text>' },
  groupinfo: { desc: 'Group info', category: 'group', usage: '.groupinfo' },
  // Protection
  antilink: { desc: 'Toggle anti-link', category: 'protection', usage: '.antilink on/off' },
  antifwd: { desc: 'Toggle anti-forward', category: 'protection', usage: '.antifwd on/off' },
  antibadword: { desc: 'Toggle anti-badword', category: 'protection', usage: '.antibadword on/off' },
  antispam: { desc: 'Toggle anti-spam', category: 'protection', usage: '.antispam on/off' },
  flood: { desc: 'Toggle flood control', category: 'protection', usage: '.flood on/off' },
  antipromote: { desc: 'Toggle anti-promote', category: 'protection', usage: '.antipromote on/off' },
  antidemote: { desc: 'Toggle anti-demote', category: 'protection', usage: '.antidemote on/off' },
  // Tools
  sticker: { desc: 'Create sticker from image', category: 'tools', usage: '.sticker (reply to image)' },
  toimg: { desc: 'Convert sticker to image', category: 'tools', usage: '.toimg (reply to sticker)' },
  translate: { desc: 'Translate text', category: 'tools', usage: '.translate <lang> <text>' },
  ttp: { desc: 'Text to picture', category: 'tools', usage: '.ttp <text>' },
  attp: { desc: 'Animated text sticker', category: 'tools', usage: '.attp <text>' },
  yts: { desc: 'YouTube search', category: 'tools', usage: '.yts <query>' },
  google: { desc: 'Google search', category: 'tools', usage: '.google <query>' },
  weather: { desc: 'Weather info', category: 'tools', usage: '.weather <city>' },
  quote: { desc: 'Random quote', category: 'tools', usage: '.quote' },
  joke: { desc: 'Random joke', category: 'tools', usage: '.joke' },
  fact: { desc: 'Random fact', category: 'tools', usage: '.fact' },
  // Owner
  setprefix: { desc: 'Change prefix', category: 'owner', usage: '.setprefix <prefix>' },
  setname: { desc: 'Change bot name', category: 'owner', usage: '.setname <name>' },
  mode: { desc: 'Switch bot mode', category: 'owner', usage: '.mode public/private' },
  broadcast: { desc: 'Broadcast to all chats', category: 'owner', usage: '.broadcast <text>' },
  shutdown: { desc: 'Stop the bot', category: 'owner', usage: '.shutdown' },
  // Fun
  '8ball': { desc: 'Magic 8-ball', category: 'fun', usage: '.8ball <question>' },
  flip: { desc: 'Flip a coin', category: 'fun', usage: '.flip' },
  dice: { desc: 'Roll dice', category: 'fun', usage: '.dice' },
  rps: { desc: 'Rock paper scissors', category: 'fun', usage: '.rps <rock/paper/scissors>' },
  guess: { desc: 'Number guessing game', category: 'fun', usage: '.guess <number>' }
};

// ===== GAMES STATE =====
let guessGame = {}; // chatId -> { number, attempts }

// ===== HEALTH CHECK SERVER (for Railway/Render) =====
const PORT = process.env.PORT || 3000;
const healthServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0b0b0b;color:#0f0">
    <h1>🤖 CCR BOT MD v6.9</h1>
    <p>Status: <b style="color:#0f0">ONLINE</b></p>
    <p>Uptime: ${getRuntime()}</p>
    <p>Owner: +${config.owner}</p>
    <p>Prefix: ${config.prefix}</p>
  </body></html>`);
});
healthServer.on('error', (e) => { console.log('⚠️ Health server port in use, continuing anyway...'); });
healthServer.listen(PORT, () => {
  console.log(`🏥 Health server running on port ${PORT}`);
});

// ===== MAIN BOT FUNCTION =====
async function startBot() {
  console.log(`🔌 Initializing ${config.botName}...`);

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: LOG_LEVEL,
    auth: state,
    browser: [config.botName, 'Chrome', '3.0'],
    markOnlineOnConnect: true,
    syncFullHistory: false,
    defaultQueryTimeoutMs: 120000, // 2 min timeout instead of default
    getMessage: async (key) => {
      return null;
    }
  });


  sock.ev.on('creds.update', saveCreds);

  // ===== GROUP EVENT LISTENER =====
  sock.ev.on('group-participants.update', async (update) => {
    const { id, participants, action } = update;
    try {
      if (action === 'promote' && protection.antipromote.status === 'on') {
        for (let user of participants) {
          await sock.groupParticipantsUpdate(id, [user], 'demote');
          await sock.sendMessage(id, {
            text: `⚠️ Anti-Promote active. Demoted @${user.split('@')[0]}`,
            mentions: [user]
          });
        }
      }
      if (action === 'demote' && protection.antidemote.status === 'on') {
        for (let user of participants) {
          await sock.groupParticipantsUpdate(id, [user], 'promote');
          await sock.sendMessage(id, {
            text: `⚠️ Anti-Demote active. Re-promoted @${user.split('@')[0]}`,
            mentions: [user]
          });
        }
      }
      // Welcome message
      if (action === 'add') {
        for (let user of participants) {
          await sock.sendMessage(id, {
            text: `👋 Welcome @${user.split('@')[0]} to the group!\n\nFeel free to chat and have fun. Type ${config.prefix}menu to see what I can do! 🤖`,
            mentions: [user]
          });
        }
      }
    } catch (e) {
      console.error('Group event error:', e);
    }
  });

  // ===== CONNECTION UPDATE (QR Image Method) =====
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📱 QR code generated! Scan with WhatsApp to connect...\n');
      // Print QR as ASCII art in terminal (shows in Railway logs)
      qrcodeTerminal.generate(qr, { small: true }, (code) => {
        console.log(code);
        console.log('📱 Open WhatsApp -> Settings -> Linked Devices -> Link a Device -> Scan above QR\n');
      });
      // Also save as PNG for direct scanning
      qrcode.toFile(path.join(__dirname, 'qr.png'), qr, {
        color: { dark: '#000000', light: '#ffffff' },
        width: 400,
        margin: 2
      }, (err) => {
        if (!err) console.log('✅ QR also saved to qr.png\n');
      });
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(`Connection closed. Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log(`\n✅ ${config.botName} is online and ready! 🚀`);
      console.log(`👤 Owner: +${config.owner}`);
      console.log(`🔧 Mode: ${config.mode.toUpperCase()}`);
      console.log(`📝 Prefix: ${config.prefix}`);

      // ===== ALIVE PING - sends to owner's inbox every 30 min =====
      const ALIVE_INTERVAL = 30 * 60 * 1000; // 30 minutes
      const ownerJid = config.owner + '@s.whatsapp.net';

      const sendAlivePing = async () => {
        try {
          const now = new Date();
          const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
          const uptime = getRuntime();

          const aliveHeader =
            '╭═══════════════════\n' +
            '│    \u26A1 CCR BOT MD \u26A1\n' +
            '│     ALIVE STATUS\n' +
            '╰═══════════════════\n\n' +
            '\U0001F7E2 *Status:* ONLINE\n' +
            '\U0001F550 *Time:* ' + timeStr + '\n' +
            '\U0001F4C5 *Date:* ' + dateStr + '\n' +
            '\u23F1\uFE0F *Uptime:* ' + uptime + '\n' +
            '\U0001F527 *Mode:* ' + config.mode.toUpperCase() + '\n' +
            '\U0001F4DD *Prefix:* (' + config.prefix + ')\n' +
            '\U0001F4E1 *Ping:* Sent to inbox\n\n' +
            '> ' + config.botName + ' ' + config.version + ' | Always alive \U0001F49A';

          await sock.sendMessage(ownerJid, { text: aliveHeader });
          console.log('✅ Alive ping sent to owner inbox');
        } catch (e) {
          console.error('❌ Alive ping failed:', e.message);
        }
      };

      // Send first alive ping after 30 seconds
      setTimeout(sendAlivePing, 30000);
      // Then repeat every 30 minutes
      const aliveInterval = setInterval(sendAlivePing, ALIVE_INTERVAL);

      // Store interval so we can clear on disconnect
      sock._aliveInterval = aliveInterval;
    }
  });

  // ===== MESSAGE HANDLER =====  // ===== MESSAGE HANDLER =====  // ===== MESSAGE HANDLER =====
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      try {
        if (!msg.message || msg.key.fromMe) continue;

        const chatId = msg.key.remoteJid;
        const sender = msg.key.participant || chatId;
        const isGroup = chatId.endsWith('@g.us');
        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          msg.message?.videoMessage?.caption ||
          '';

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const isMedia =
          msg.message?.imageMessage ||
          msg.message?.videoMessage ||
          msg.message?.stickerMessage ||
          msg.message?.audioMessage ||
          msg.message?.documentMessage;

        // ===== ANTI-BADWORD =====
        if (protection.antibadword.status === 'on' && text) {
          let lowerText = text.toLowerCase();
          let found = antibad.words.some((w) => lowerText.includes(w));
          if (found && !isOwner(sender)) {
            try {
              await sock.sendMessage(chatId, { delete: msg.key });
              await sock.sendMessage(chatId, {
                text: `⚠️ @${sender.split('@')[0]} bad words are not allowed here!`,
                mentions: [sender]
              });
            } catch {}
            continue;
          }
        }

        // ===== ANTI-LINK =====
        if (protection.antilink.status === 'on' && text && containsLink(text) && !isOwner(sender)) {
          if (isGroup) {
            try {
              await sock.sendMessage(chatId, { delete: msg.key });
              await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
              await sock.sendMessage(chatId, {
                text: `🚫 @${sender.split('@')[0]} was removed for posting a link!`,
                mentions: [sender]
              });
            } catch {}
            continue;
          }
        }

        // ===== ANTI-FORWARD =====
        if (protection.antifwd.status === 'on' && msg.message?.extendedTextMessage?.contextInfo?.isForwarded) {
          if (!isOwner(sender)) {
            try {
              await sock.sendMessage(chatId, { delete: msg.key });
              await sock.sendMessage(chatId, {
                text: `⚠️ Forwarded messages are not allowed!`
              });
            } catch {}
            continue;
          }
        }

        // ===== ANTI-SPAM =====
        if (protection.antispam.status === 'on' && text) {
          let key = `${chatId}:${sender}`;
          let now = Date.now();
          if (!spamTracker[key]) spamTracker[key] = [];
          spamTracker[key].push(now);
          spamTracker[key] = spamTracker[key].filter((t) => now - t < 5000);
          if (spamTracker[key].length > 5 && !isOwner(sender)) {
            try {
              await sock.sendMessage(chatId, { delete: msg.key });
              await sock.sendMessage(chatId, {
                text: `⚠️ @${sender.split('@')[0]} stop spamming!`,
                mentions: [sender]
              });
            } catch {}
            delete spamTracker[key];
            continue;
          }
        }

        // ===== FLOOD CONTROL =====
        if (protection.flood.status === 'on' && text) {
          let key = `${chatId}:${sender}`;
          let now = Date.now();
          if (!floodTracker[key]) floodTracker[key] = [];
          floodTracker[key].push(now);
          floodTracker[key] = floodTracker[key].filter((t) => now - t < 3000);
          if (floodTracker[key].length > 10 && !isOwner(sender)) {
            try {
              await sock.sendMessage(chatId, { delete: msg.key });
              await sock.sendMessage(chatId, {
                text: `🌊 @${sender.split('@')[0]} flooding detected! Slow down.`,
                mentions: [sender]
              });
            } catch {}
            delete floodTracker[key];
            continue;
          }
        }

        // ===== ECONOMY: XP GAIN =====
        if (ecoSettings.on && text) {
          let ecoUser = getEcoUser(sender);
          let xpGain = randomInt(1, 5);
          ecoUser.xp += xpGain;
          ecoLevelUp(sender, sock, chatId);
        }

        // ===== COMMAND HANDLING =====
        if (!text) continue;

        const usedPrefix = text.charAt(0);
        if (!config.prefix.includes(usedPrefix) && text.startsWith(config.prefix) === false) {
          // Also check if text starts with any common prefix
          if (!['.', '!', '/', '#', '$'].includes(usedPrefix)) continue;
        }

        const body = text.slice(1).trim();
        const command = body.split(' ')[0].toLowerCase();
        const args = body.split(' ').slice(1);
        const argText = args.join(' ');

        // ===== MAIN COMMANDS =====

        if (command === 'menu' || command === 'list' || command === 'commands') {
          let header = await getHeader(sock, chatId, sender);
          let menuText =
            '╭═══════════════════════‬\n' +
            '│  ⚡ CCR BOT MD ' + config.version + ' ⚡\n' +
            '│  ⌬ Command Center ⌬\n' +
            '╰═══════════════════════‬\n\n' +
            '━━━ 📌 MAIN ━━━\n' +
            config.prefix + 'menu  •  ' + config.prefix + 'alive  •  ' + config.prefix + 'ping\n' +
            config.prefix + 'runtime  •  ' + config.prefix + 'owner  •  ' + config.prefix + 'info\n\n' +
            '━━━ 💰 ECONOMY ━━━\n' +
            config.prefix + 'wallet  •  ' + config.prefix + 'bank  •  ' + config.prefix + 'daily\n' +
            config.prefix + 'work  •  ' + config.prefix + 'crime  •  ' + config.prefix + 'hunt\n' +
            config.prefix + 'fish  •  ' + config.prefix + 'mine  •  ' + config.prefix + 'deposit\n' +
            config.prefix + 'withdraw  •  ' + config.prefix + 'transfer  •  ' + config.prefix + 'leaderboard\n\n' +
            '━━━ 👥 GROUP ━━━\n' +
            config.prefix + 'kick  •  ' + config.prefix + 'promote  •  ' + config.prefix + 'demote\n' +
            config.prefix + 'tagall  •  ' + config.prefix + 'hidetag  •  ' + config.prefix + 'grouplink\n' +
            config.prefix + 'setname  •  ' + config.prefix + 'setdesc  •  ' + config.prefix + 'groupinfo\n\n' +
            '━━━ 🛡️ PROTECTION ━━━\n' +
            config.prefix + 'antilink  •  ' + config.prefix + 'antifwd  •  ' + config.prefix + 'antibadword\n' +
            config.prefix + 'antispam  •  ' + config.prefix + 'flood  •  ' + config.prefix + 'antipromote\n' +
            config.prefix + 'antidemote\n\n' +
            '━━━ 🛠️ TOOLS ━━━\n' +
            config.prefix + 'sticker  •  ' + config.prefix + 'toimg  •  ' + config.prefix + 'translate\n' +
            config.prefix + 'ttp  •  ' + config.prefix + 'attp  •  ' + config.prefix + 'yts\n' +
            config.prefix + 'weather  •  ' + config.prefix + 'quote  •  ' + config.prefix + 'joke\n' +
            config.prefix + 'fact\n\n' +
            '━━━ 🎮 FUN ━━━\n' +
            config.prefix + '8ball  •  ' + config.prefix + 'flip  •  ' + config.prefix + 'dice\n' +
            config.prefix + 'rps  •  ' + config.prefix + 'guess\n\n' +
            '━━━ 👑 OWNER ━━━\n' +
            config.prefix + 'setprefix  •  ' + config.prefix + 'setname  •  ' + config.prefix + 'mode\n' +
            config.prefix + 'broadcast  •  ' + config.prefix + 'shutdown\n\n' +
            '╭═══════════════════════‬\n' +
            '│  ⚡ Powered by Baileys ⚡\n' +
            '│  👑 Clarence Rajah\n' +
            '╰═══════════════════════‬';

          await sock.sendMessage(chatId, { text: menuText });
          continue;
        }

        if (command === 'alive') {
          let header = await getHeader(sock, chatId, sender);
          await sock.sendMessage(chatId, {
            text:
              header + '\n\n' +
              '✅ *Bot is alive and running!*\n' +
              `⏰ Uptime: ${getRuntime()}\n` +
              `🔧 Mode: ${config.mode.toUpperCase()}\n` +
              `📝 Prefix: ${config.prefix}\n` +
              `> ${config.botName} ${config.version}`
          });
          continue;
        }

        if (command === 'ping') {
          const start = Date.now();
          await sock.sendMessage(chatId, { text: '🏓 Pinging...' });
          const latency = Date.now() - start;
          await sock.sendMessage(chatId, {
            text: `🏓 Pong! Speed: ${latency}ms\n⚡ ${latency < 500 ? 'Excellent' : latency < 1000 ? 'Good' : 'Slow'}`
          });
          continue;
        }

        if (command === 'runtime') {
          await sock.sendMessage(chatId, {
            text: `⏰ *Bot Runtime*\n\n${getRuntime()}\n\n> ${config.botName} ${config.version}`
          });
          continue;
        }

        if (command === 'owner') {
          await sock.sendMessage(chatId, {
            text:
              `👑 *BOT OWNER*\n\n` +
              `👤 Name: Clarence Rajah\n` +
              `📱 Number: +${config.owner}\n` +
              `🤖 Bot: ${config.botName} ${config.version}\n` +
              `🔧 Mode: ${config.mode.toUpperCase()}\n\n` +
              `> Respect the owner! 🙏`
          });
          continue;
        }

        if (command === 'info') {
          let header = await getHeader(sock, chatId, sender);
          await sock.sendMessage(chatId, {
            text:
              header + '\n\n' +
              `📚 *ABOUT*\n` +
              `${config.botName} is a multi-feature WhatsApp bot built with Baileys.\n` +
              `Features: Economy, Group Management, Protection, Tools, Games & more!\n\n` +
              `📡 Library: @whiskeysockets/baileys\n` +
              `🌐 Node.js: ${process.version}\n` +
              `📦 Commands: ${Object.keys(commands).length}+\n` +
              `> ${config.botName} ${config.version}`
          });
          continue;
        }

        if (command === 'help') {
          if (args[0] && commands[args[0].toLowerCase()]) {
            let cmd = args[0].toLowerCase();
            await sock.sendMessage(chatId, {
              text: `📖 *Help: ${config.prefix}${cmd}*\n\n${commands[cmd].desc}\n\nUsage: \`${commands[cmd].usage}\`\nCategory: ${commands[cmd].category}`
            });
          } else {
            await sock.sendMessage(chatId, {
              text: `📖 Type \`${config.prefix}menu\` to see all commands.\nUse \`${config.prefix}help <command>\` for specific command help.`
            });
          }
          continue;
        }

        // ===== ECONOMY COMMANDS =====
        if (ecoSettings.on) {
          if (command === 'wallet' || command === 'balance') {
            let user = getEcoUser(sender);
            await sock.sendMessage(chatId, {
              text:
                `💰 *Wallet Balance*\n\n` +
                `👤 User: @${sender.split('@')[0]}\n` +
                `💵 Wallet: ${formatMoney(user.wallet)}\n` +
                `🏦 Bank: ${formatMoney(user.bank)}\n` +
                `⭐ Level: ${user.level}\n` +
                `✨ XP: ${user.xp}/${user.level * 100}`,
              mentions: [sender]
            });
            continue;
          }

          if (command === 'bank') {
            let user = getEcoUser(sender);
            await sock.sendMessage(chatId, {
              text:
                `🏦 *Bank Account*\n\n` +
                `👤 User: @${sender.split('@')[0]}\n` +
                `🏦 Balance: ${formatMoney(user.bank)}\n` +
                `💵 Wallet: ${formatMoney(user.wallet)}`,
              mentions: [sender]
            });
            continue;
          }

          if (command === 'daily') {
            let user = getEcoUser(sender);
            let cooldown = 86400000; // 24h
            let remaining = cooldown - (Date.now() - user.lastDaily);
            if (remaining > 0) {
              let h = Math.floor(remaining / 3600000);
              let m = Math.floor((remaining % 3600000) / 60000);
              await sock.sendMessage(chatId, {
                text: `⏰ You already claimed your daily reward!\nCome back in ${h}h ${m}m.`
              });
            } else {
              let reward = 50 + user.level * 10;
              user.wallet += reward;
              user.lastDaily = Date.now();
              await sock.sendMessage(chatId, {
                text:
                  `🎁 *Daily Reward Claimed!*\n\n` +
                  `💰 +${formatMoney(reward)}\n` +
                  `💵 Wallet: ${formatMoney(user.wallet)}\n` +
                  `⭐ Level: ${user.level}`,
                mentions: [sender]
              });
            }
            continue;
          }

          if (command === 'work') {
            let user = getEcoUser(sender);
            let cooldown = 3600000; // 1h
            let remaining = cooldown - (Date.now() - user.lastWork);
            if (remaining > 0) {
              let m = Math.ceil(remaining / 60000);
              await sock.sendMessage(chatId, {
                text: `😴 You're tired! Come back in ${m} minutes.`
              });
            } else {
              let jobs = ['programmer', 'chef', 'driver', 'teacher', 'doctor', 'artist', 'singer', 'farmer', 'mechanic', 'barber'];
              let job = pickRandom(jobs);
              let earned = randomInt(20, 80) + user.level * 5;
              user.wallet += earned;
              user.lastWork = Date.now();
              await sock.sendMessage(chatId, {
                text:
                  `💼 *Work Complete!*\n\n` +
                  `You worked as a ${job}.\n` +
                  `💰 Earned: +${formatMoney(earned)}\n` +
                  `💵 Wallet: ${formatMoney(user.wallet)}`,
                mentions: [sender]
              });
            }
            continue;
          }

          if (command === 'crime') {
            let user = getEcoUser(sender);
            let cooldown = 7200000; // 2h
            let remaining = cooldown - (Date.now() - user.lastCrime);
            if (remaining > 0) {
              let m = Math.ceil(remaining / 60000);
              await sock.sendMessage(chatId, {
                text: `🚔 You're lying low. Wait ${m} minutes before your next crime.`
              });
            } else {
              let success = Math.random() > 0.4;
              if (success) {
                let stolen = randomInt(50, 200) + user.level * 10;
                user.wallet += stolen;
                await sock.sendMessage(chatId, {
                  text:
                    `🦹 *Crime Successful!*\n\n` +
                    `💰 You stole: +${formatMoney(stolen)}\n` +
                    `💵 Wallet: ${formatMoney(user.wallet)}`,
                  mentions: [sender]
                });
              } else {
                let fine = randomInt(20, 100);
                user.wallet = Math.max(0, user.wallet - fine);
                await sock.sendMessage(chatId, {
                  text:
                    `🚨 *You got caught!*\n\n` +
                    `💰 Fine: -${formatMoney(fine)}\n` +
                    `💵 Wallet: ${formatMoney(user.wallet)}`,
                  mentions: [sender]
                });
              }
              user.lastCrime = Date.now();
            }
            continue;
          }

          if (command === 'hunt') {
            let user = getEcoUser(sender);
            let cooldown = 1800000; // 30min
            let remaining = cooldown - (Date.now() - user.lastHunt);
            if (remaining > 0) {
              let m = Math.ceil(remaining / 60000);
              await sock.sendMessage(chatId, {
                text: `🏹 You need to rest. Wait ${m} minutes.`
              });
            } else {
              let animals = ['🦌 Deer', '🐇 Rabbit', '🦊 Fox', '🐻 Bear', '🦁 Lion', '🐗 Boar', '🦅 Eagle', '🐺 Wolf'];
              let animal = pickRandom(animals);
              let reward = randomInt(15, 60) + user.level * 5;
              user.wallet += reward;
              user.lastHunt = Date.now();
              await sock.sendMessage(chatId, {
                text:
                  `🏹 *Hunt Successful!*\n\n` +
                  `You hunted a ${animal}\n` +
                  `💰 Reward: +${formatMoney(reward)}\n` +
                  `💵 Wallet: ${formatMoney(user.wallet)}`,
                mentions: [sender]
              });
            }
            continue;
          }

          if (command === 'fish') {
            let user = getEcoUser(sender);
            let cooldown = 1800000; // 30min
            let remaining = cooldown - (Date.now() - user.lastFish);
            if (remaining > 0) {
              let m = Math.ceil(remaining / 60000);
              await sock.sendMessage(chatId, {
                text: `🎣 The fish aren't biting. Wait ${m} minutes.`
              });
            } else {
              let fish = ['🐟 Tuna', '🐠 Goldfish', '🐡 Blowfish', '🦈 Shark', '🐙 Octopus', '🦐 Shrimp', '🦞 Lobster', '🐳 Whale'];
              let catch_ = pickRandom(fish);
              let reward = randomInt(10, 50) + user.level * 3;
              user.wallet += reward;
              user.lastFish = Date.now();
              await sock.sendMessage(chatId, {
                text:
                  `🎣 *Fishing Success!*\n\n` +
                  `You caught a ${catch_}\n` +
                  `💰 Reward: +${formatMoney(reward)}\n` +
                  `💵 Wallet: ${formatMoney(user.wallet)}`,
                mentions: [sender]
              });
            }
            continue;
          }

          if (command === 'mine') {
            let user = getEcoUser(sender);
            let cooldown = 1800000; // 30min
            let remaining = cooldown - (Date.now() - user.lastMine);
            if (remaining > 0) {
              let m = Math.ceil(remaining / 60000);
              await sock.sendMessage(chatId, {
                text: `⛏️ The mine is collapsed. Wait ${m} minutes.`
              });
            } else {
              let ores = ['💎 Diamond', '🥇 Gold', '🥈 Silver', '🟢 Emerald', '🔵 Sapphire', '🔴 Ruby', '⚪ Iron', '⚫ Coal'];
              let ore = pickRandom(ores);
              let reward = randomInt(15, 70) + user.level * 5;
              user.wallet += reward;
              user.lastMine = Date.now();
              await sock.sendMessage(chatId, {
                text:
                  `⛏️ *Mining Success!*\n\n` +
                  `You found ${ore}\n` +
                  `💰 Reward: +${formatMoney(reward)}\n` +
                  `💵 Wallet: ${formatMoney(user.wallet)}`,
                mentions: [sender]
              });
            }
            continue;
          }

          if (command === 'deposit') {
            let user = getEcoUser(sender);
            let amount = parseInt(args[0]);
            if (!amount || amount <= 0) {
              await sock.sendMessage(chatId, {
                text: `❌ Usage: ${config.prefix}deposit <amount>\nExample: ${config.prefix}deposit 100`
              });
              continue;
            }
            if (amount > user.wallet) {
              await sock.sendMessage(chatId, {
                text: `❌ You don't have enough in your wallet!\n💵 Wallet: ${formatMoney(user.wallet)}`
              });
              continue;
            }
            user.wallet -= amount;
            user.bank += amount;
            await sock.sendMessage(chatId, {
              text:
                `✅ *Deposited!*\n\n` +
                `💰 Amount: ${formatMoney(amount)}\n` +
                `💵 Wallet: ${formatMoney(user.wallet)}\n` +
                `🏦 Bank: ${formatMoney(user.bank)}`,
              mentions: [sender]
            });
            continue;
          }

          if (command === 'withdraw') {
            let user = getEcoUser(sender);
            let amount = parseInt(args[0]);
            if (!amount || amount <= 0) {
              await sock.sendMessage(chatId, {
                text: `❌ Usage: ${config.prefix}withdraw <amount>\nExample: ${config.prefix}withdraw 100`
              });
              continue;
            }
            if (amount > user.bank) {
              await sock.sendMessage(chatId, {
                text: `❌ You don't have enough in your bank!\n🏦 Bank: ${formatMoney(user.bank)}`
              });
              continue;
            }
            user.bank -= amount;
            user.wallet += amount;
            await sock.sendMessage(chatId, {
              text:
                `✅ *Withdrawn!*\n\n` +
                `💰 Amount: ${formatMoney(amount)}\n` +
                `💵 Wallet: ${formatMoney(user.wallet)}\n` +
                `🏦 Bank: ${formatMoney(user.bank)}`,
              mentions: [sender]
            });
            continue;
          }

          if (command === 'transfer') {
            let target = mentionedJids[0] || (args[0] && args[0].replace(/[@]/g, '') + '@s.whatsapp.net');
            let amount = parseInt(args[1]) || parseInt(args[args.length - 1]);
            if (!target || !amount) {
              await sock.sendMessage(chatId, {
                text: `❌ Usage: ${config.prefix}transfer @user <amount>`
              });
              continue;
            }
            let user = getEcoUser(sender);
            if (amount > user.wallet) {
              await sock.sendMessage(chatId, {
                text: `❌ Insufficient wallet balance!\n💵 Wallet: ${formatMoney(user.wallet)}`
              });
              continue;
            }
            let targetUser = getEcoUser(target);
            user.wallet -= amount;
            targetUser.wallet += amount;
            await sock.sendMessage(chatId, {
              text:
                `💸 *Transfer Complete!*\n\n` +
                `👤 From: @${sender.split('@')[0]}\n` +
                `👤 To: @${target.split('@')[0]}\n` +
                `💰 Amount: ${formatMoney(amount)}\n` +
                `💵 Your Wallet: ${formatMoney(user.wallet)}`,
              mentions: [sender, target]
            });
            continue;
          }

          if (command === 'leaderboard' || command === 'lb') {
            let users = Object.entries(economyDB)
              .map(([jid, data]) => ({ jid, wallet: data.wallet + data.bank }))
              .sort((a, b) => b.wallet - a.wallet)
              .slice(0, 10);
            if (users.length === 0) {
              await sock.sendMessage(chatId, { text: '📊 No economy data yet!' });
              continue;
            }
            let lb = '🏆 *LEADERBOARD - Richest Users*\n\n';
            users.forEach((u, i) => {
              let medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
              lb += `${medal} @${u.jid.split('@')[0]} — ${formatMoney(u.wallet)}\n`;
            });
            await sock.sendMessage(chatId, {
              text: lb,
              mentions: users.map((u) => u.jid)
            });
            continue;
          }
        }

        // ===== GROUP MANAGEMENT =====
        if (isGroup) {
          if (command === 'kick' || command === 'remove') {
            if (!isOwner(sender)) {
              await sock.sendMessage(chatId, { text: '❌ Owner only command!' });
              continue;
            }
            let target = mentionedJids[0];
            if (!target) {
              await sock.sendMessage(chatId, { text: '❌ Tag someone to kick!\nUsage: .kick @user' });
              continue;
            }
            try {
              await sock.groupParticipantsUpdate(chatId, [target], 'remove');
              await sock.sendMessage(chatId, {
                text: `✅ Kicked @${target.split('@')[0]}`,
                mentions: [target]
              });
            } catch {
              await sock.sendMessage(chatId, { text: '❌ Failed to kick. Make sure I am admin!' });
            }
            continue;
          }

          if (command === 'promote') {
            if (!isOwner(sender)) {
              await sock.sendMessage(chatId, { text: '❌ Owner only command!' });
              continue;
            }
            let target = mentionedJids[0];
            if (!target) {
              await sock.sendMessage(chatId, { text: '❌ Tag someone to promote!' });
              continue;
            }
            try {
              await sock.groupParticipantsUpdate(chatId, [target], 'promote');
              await sock.sendMessage(chatId, {
                text: `✅ Promoted @${target.split('@')[0]} to admin!`,
                mentions: [target]
              });
            } catch {
              await sock.sendMessage(chatId, { text: '❌ Failed to promote. Make sure I am admin!' });
            }
            continue;
          }

          if (command === 'demote') {
            if (!isOwner(sender)) {
              await sock.sendMessage(chatId, { text: '❌ Owner only command!' });
              continue;
            }
            let target = mentionedJids[0];
            if (!target) {
              await sock.sendMessage(chatId, { text: '❌ Tag someone to demote!' });
              continue;
            }
            try {
              await sock.groupParticipantsUpdate(chatId, [target], 'demote');
              await sock.sendMessage(chatId, {
                text: `✅ Demoted @${target.split('@')[0]}`,
                mentions: [target]
              });
            } catch {
              await sock.sendMessage(chatId, { text: '❌ Failed to demote. Make sure I am admin!' });
            }
            continue;
          }

          if (command === 'tagall' || command === 'tag') {
            if (!isOwner(sender)) {
              await sock.sendMessage(chatId, { text: '❌ Owner only command!' });
              continue;
            }
            try {
              let metadata = await sock.groupMetadata(chatId);
              let participants = metadata.participants.map((p) => p.id);
              let txt = `📢 *TAG ALL*\n\n${argText ? argText + '\n\n' : ''}`;
              participants.forEach((p, i) => {
                txt += `@${p.split('@')[0]}` + (i < participants.length - 1 ? ' ' : '');
              });
              await sock.sendMessage(chatId, {
                text: txt,
                mentions: participants
              });
            } catch {
              await sock.sendMessage(chatId, { text: '❌ Failed to get group members!' });
            }
            continue;
          }

          if (command === 'hidetag') {
            if (!isOwner(sender)) {
              await sock.sendMessage(chatId, { text: '❌ Owner only command!' });
              continue;
            }
            try {
              let metadata = await sock.groupMetadata(chatId);
              let participants = metadata.participants.map((p) => p.id);
              await sock.sendMessage(chatId, {
                text: argText || '📢 Hidden tag',
                mentions: participants
              });
            } catch {
              await sock.sendMessage(chatId, { text: '❌ Failed!' });
            }
            continue;
          }

          if (command === 'grouplink' || command === 'link') {
            if (!isOwner(sender)) {
              await sock.sendMessage(chatId, { text: '❌ Owner only command!' });
              continue;
            }
            try {
              let code = await sock.groupInviteCode(chatId);
              await sock.sendMessage(chatId, {
                text: `🔗 *Group Invite Link*\n\nhttps://chat.whatsapp.com/${code}`
              });
            } catch {
              await sock.sendMessage(chatId, { text: '❌ Failed to get link!' });
            }
            continue;
          }

          if (command === 'setname') {
            if (!isOwner(sender)) {
              await sock.sendMessage(chatId, { text: '❌ Owner only command!' });
              continue;
            }
            if (!argText) {
              await sock.sendMessage(chatId, { text: '❌ Provide a name!\nUsage: .setname New Group Name' });
              continue;
            }
            try {
              await sock.groupUpdateSubject(chatId, argText);
              await sock.sendMessage(chatId, { text: `✅ Group name changed to: ${argText}` });
            } catch {
              await sock.sendMessage(chatId, { text: '❌ Failed. Make sure I am admin!' });
            }
            continue;
          }

          if (command === 'setdesc') {
            if (!isOwner(sender)) {
              await sock.sendMessage(chatId, { text: '❌ Owner only command!' });
              continue;
            }
            if (!argText) {
              await sock.sendMessage(chatId, { text: '❌ Provide a description!\nUsage: .setdesc Description' });
              continue;
            }
            try {
              await sock.groupUpdateDescription(chatId, argText);
              await sock.sendMessage(chatId, { text: `✅ Group description updated!` });
            } catch {
              await sock.sendMessage(chatId, { text: '❌ Failed. Make sure I am admin!' });
            }
            continue;
          }

          if (command === 'groupinfo' || command === 'ginfo') {
            try {
              let metadata = await sock.groupMetadata(chatId);
              let txt =
                `📋 *GROUP INFO*\n\n` +
                `🆔 ID: ${metadata.id}\n` +
                `📝 Name: ${metadata.subject}\n` +
                `👥 Members: ${metadata.participants.length}\n` +
                `👤 Owner: ${metadata.owner ? metadata.owner.split('@')[0] : 'Unknown'}\n` +
                `📝 Desc: ${metadata.desc || 'No description'}\n` +
                `📅 Created: ${moment.unix(metadata.creation).format('DD/MM/YYYY')}`;
              await sock.sendMessage(chatId, { text: txt });
            } catch {
              await sock.sendMessage(chatId, { text: '❌ Failed to get group info!' });
            }
            continue;
          }
        }

        // ===== PROTECTION TOGGLES =====
        const protectionCommands = ['antilink', 'antifwd', 'antibadword', 'antispam', 'flood', 'antipromote', 'antidemote'];
        if (protectionCommands.includes(command)) {
          if (!isOwner(sender)) {
            await sock.sendMessage(chatId, { text: '❌ Owner only command!' });
            continue;
          }
          let status = args[0]?.toLowerCase();
          if (status !== 'on' && status !== 'off') {
            await sock.sendMessage(chatId, {
              text: `❌ Usage: ${config.prefix}${command} on/off\nCurrent: ${protection[command].status}`
            });
            continue;
          }
          protection[command].status = status;
          await sock.sendMessage(chatId, {
            text: `✅ *${command.toUpperCase()}* is now *${status.toUpperCase()}*!`
          });
          continue;
        }

        // ===== TOOLS =====
        if (command === 'sticker' || command === 's') {
          if (!isMedia && !quoted) {
            await sock.sendMessage(chatId, {
              text: `❌ Reply to an image or send an image with caption!\nUsage: ${config.prefix}sticker`
            });
            continue;
          }
          try {
            let mediaMsg = quoted
              ? msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
              : msg.message;
            let downloadMsg = quoted
              ? {
                  key: { remoteJid: chatId, id: msg.message.extendedTextMessage.contextInfo.stanzaId },
                  message: quoted
                }
              : msg;

            let buffer = await downloadMediaMessage(downloadMsg, 'buffer', {}, { logger: LOG_LEVEL });
            if (buffer) {
              await sock.sendMessage(chatId, {
                sticker: buffer,
                quoted: msg
              });
            } else {
              await sock.sendMessage(chatId, { text: '❌ Could not download the media!' });
            }
          } catch (e) {
            console.error('Sticker error:', e);
            await sock.sendMessage(chatId, { text: '❌ Failed to create sticker. Make sure you replied to an image!' });
          }
          continue;
        }

        if (command === 'toimg' || command === 'toimage') {
          if (!quoted || !quoted.stickerMessage) {
            await sock.sendMessage(chatId, {
              text: `❌ Reply to a sticker!\nUsage: ${config.prefix}toimg`
            });
            continue;
          }
          try {
            let downloadMsg = {
              key: { remoteJid: chatId, id: msg.message.extendedTextMessage.contextInfo.stanzaId },
              message: quoted
            };
            let buffer = await downloadMediaMessage(downloadMsg, 'buffer', {}, { logger: LOG_LEVEL });
            // Send as image - Baileys handles conversion for static stickers
            await sock.sendMessage(chatId, {
              image: buffer,
              quoted: msg
            });
          } catch (e) {
            console.error('toimg error:', e);
            await sock.sendMessage(chatId, { text: '❌ Failed to convert sticker!' });
          }
          continue;
        }

        if (command === 'translate') {
          if (!args[0] || !args[1]) {
            await sock.sendMessage(chatId, {
              text: `❌ Usage: ${config.prefix}translate <lang> <text>\nExample: ${config.prefix}translate fr Hello World`
            });
            continue;
          }
          try {
            let lang = args[0];
            let textToTranslate = args.slice(1).join(' ');
            let result = await translate(textToTranslate, { to: lang });
            await sock.sendMessage(chatId, {
              text:
                `🌍 *Translation*\n\n` +
                `📝 Original: ${textToTranslate}\n` +
                `🌐 ${lang.toUpperCase()}: ${result.text}\n` +
                `🔄 Detected: ${result.from.language.iso.toUpperCase()}`
            });
          } catch (e) {
            await sock.sendMessage(chatId, { text: '❌ Translation failed! Check the language code.' });
          }
          continue;
        }

        if (command === 'ttp') {
          if (!argText) {
            await sock.sendMessage(chatId, { text: `❌ Usage: ${config.prefix}ttp <text>` });
            continue;
          }
          try {
            let url = `https://api.lolhuman.xyz/api/ttp?text=${encodeURIComponent(argText)}`;
            let res = await axios.get(url, { responseType: 'arraybuffer' });
            await sock.sendMessage(chatId, {
              sticker: Buffer.from(res.data),
              quoted: msg
            });
          } catch {
            await sock.sendMessage(chatId, { text: '❌ Failed to create text picture!' });
          }
          continue;
        }

        if (command === 'attp') {
          if (!argText) {
            await sock.sendMessage(chatId, { text: `❌ Usage: ${config.prefix}attp <text>` });
            continue;
          }
          try {
            let url = `https://api.lolhuman.xyz/api/attp?text=${encodeURIComponent(argText)}`;
            let res = await axios.get(url, { responseType: 'arraybuffer' });
            await sock.sendMessage(chatId, {
              sticker: Buffer.from(res.data),
              quoted: msg
            });
          } catch {
            await sock.sendMessage(chatId, { text: '❌ Failed to create animated sticker!' });
          }
          continue;
        }

        if (command === 'yts' || command === 'ytsearch') {
          if (!argText) {
            await sock.sendMessage(chatId, { text: `❌ Usage: ${config.prefix}yts <query>` });
            continue;
          }
          try {
            let results = await yts(argText);
            let videos = results.videos.slice(0, 5);
            let txt = `🔍 *YouTube Search: "${argText}"*\n\n`;
            videos.forEach((v, i) => {
              txt +=
                `${i + 1}. *${v.title}*\n` +
                `   ⏱️ ${v.timestamp} | 👁️ ${v.views} | 📅 ${v.ago}\n` +
                `   🔗 ${v.url}\n\n`;
            });
            await sock.sendMessage(chatId, { text: txt });
          } catch {
            await sock.sendMessage(chatId, { text: '❌ YouTube search failed!' });
          }
          continue;
        }

        if (command === 'google') {
          if (!argText) {
            await sock.sendMessage(chatId, { text: `❌ Usage: ${config.prefix}google <query>` });
            continue;
          }
          try {
            let url = `https://www.google.com/search?q=${encodeURIComponent(argText)}`;
            await sock.sendMessage(chatId, {
              text:
                `🔍 *Google Search*\n\n` +
                `📝 Query: ${argText}\n` +
                `🔗 ${url}`
            });
          } catch {
            await sock.sendMessage(chatId, { text: '❌ Search failed!' });
          }
          continue;
        }

        if (command === 'weather') {
          if (!argText) {
            await sock.sendMessage(chatId, { text: `❌ Usage: ${config.prefix}weather <city>` });
            continue;
          }
          try {
            let url = `https://wttr.in/${encodeURIComponent(argText)}?format=3`;
            let res = await axios.get(url);
            await sock.sendMessage(chatId, {
              text: `🌤️ *Weather: ${argText}*\n\n${res.data}`
            });
          } catch {
            await sock.sendMessage(chatId, { text: '❌ Weather lookup failed!' });
          }
          continue;
        }

        if (command === 'quote') {
          try {
            let res = await axios.get('https://api.quotable.io/random');
            await sock.sendMessage(chatId, {
              text:
                `💬 *Quote*\n\n` +
                `"${res.data.content}"\n\n` +
                `— ${res.data.author}`
            });
          } catch {
            let quotes = [
              'The only way to do great work is to love what you do. — Steve Jobs',
              'Success is not final, failure is not fatal. — Winston Churchill',
              'Believe you can and you\'re halfway there. — Theodore Roosevelt',
              'The best time to plant a tree was 20 years ago. The second best time is now. — Chinese Proverb'
            ];
            await sock.sendMessage(chatId, { text: `💬 *Quote*\n\n"${pickRandom(quotes)}"` });
          }
          continue;
        }

        if (command === 'joke') {
          try {
            let res = await axios.get('https://official-joke-api.appspot.com/random_joke');
            await sock.sendMessage(chatId, {
              text: `😂 *Joke*\n\n${res.data.setup}\n\n${res.data.punchline}`
            });
          } catch {
            let jokes = [
              'Why don\'t programmers like nature? It has too many bugs.',
              'I told my computer I needed a break, and it said "No problem — I\'ll go to sleep."',
              'Why did the developer go broke? Because he used up all his cache.'
            ];
            await sock.sendMessage(chatId, { text: `😂 ${pickRandom(jokes)}` });
          }
          continue;
        }

        if (command === 'fact') {
          try {
            let res = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random');
            await sock.sendMessage(chatId, {
              text: `🧠 *Random Fact*\n\n${res.data.text}`
            });
          } catch {
            let facts = [
              'Honey never spoils. Archaeologists have found 3000-year-old honey that\'s still edible.',
              'Octopuses have three hearts and blue blood.',
              'A group of flamingos is called a "flamboyance".',
              'Bananas are technically berries, but strawberries aren\'t.'
            ];
            await sock.sendMessage(chatId, { text: `🧠 ${pickRandom(facts)}` });
          }
          continue;
        }

        // ===== FUN COMMANDS =====
        if (command === '8ball' || command === 'eightball') {
          if (!argText) {
            await sock.sendMessage(chatId, { text: `❌ Ask a question!\nUsage: ${config.prefix}8ball <question>` });
            continue;
          }
          let answers = [
            'Yes, definitely! ✅',
            'Without a doubt! ✅',
            'Yes! ✅',
            'Most likely! ✅',
            'Ask again later... 🤔',
            'Cannot predict now... 🤔',
            'Don\'t count on it ❌',
            'My reply is no ❌',
            'Very doubtful ❌',
            'Outlook not so good ❌'
          ];
          await sock.sendMessage(chatId, {
            text: `🎱 *Magic 8-Ball*\n\n❓ ${argText}\n\n🎱 ${pickRandom(answers)}`
          });
          continue;
        }

        if (command === 'flip' || command === 'coinflip') {
          let result = Math.random() < 0.5 ? 'Heads 🪙' : 'Tails 🪙';
          await sock.sendMessage(chatId, { text: `🪙 *Coin Flip*\n\nResult: ${result}` });
          continue;
        }

        if (command === 'dice') {
          let result = randomInt(1, 6);
          await sock.sendMessage(chatId, { text: `🎲 *Dice Roll*\n\nResult: ${result} 🎲` });
          continue;
        }

        if (command === 'rps' || command === 'rockpaperscissors') {
          let choices = ['rock', 'paper', 'scissors'];
          let userChoice = args[0]?.toLowerCase();
          if (!userChoice || !choices.includes(userChoice)) {
            await sock.sendMessage(chatId, {
              text: `❌ Usage: ${config.prefix}rps <rock/paper/scissors>`
            });
            continue;
          }
          let botChoice = pickRandom(choices);
          let result;
          if (userChoice === botChoice) result = 'Tie! 🤝';
          else if (
            (userChoice === 'rock' && botChoice === 'scissors') ||
            (userChoice === 'paper' && botChoice === 'rock') ||
            (userChoice === 'scissors' && botChoice === 'paper')
          )
            result = 'You win! 🎉';
          else result = 'Bot wins! 🤖';

          let emoji = botChoice === 'rock' ? '🪨' : botChoice === 'paper' ? '📄' : '✂️';
          await sock.sendMessage(chatId, {
            text:
              `✊📄✂️ *Rock Paper Scissors*\n\n` +
              `You: ${userChoice}\n` +
              `Bot: ${botChoice} ${emoji}\n\n` +
              `Result: ${result}`
          });
          continue;
        }

        if (command === 'guess') {
          let chatKey = chatId + ':' + sender;
          if (!guessGame[chatKey]) {
            guessGame[chatKey] = { number: randomInt(1, 100), attempts: 0 };
            await sock.sendMessage(chatId, {
              text: `🎮 *Number Guessing Game Started!*\n\nI'm thinking of a number between 1 and 100.\nType ${config.prefix}guess <number> to guess!`
            });
            continue;
          }
          let game = guessGame[chatKey];
          let guess = parseInt(args[0]);
          if (!guess) {
            await sock.sendMessage(chatId, { text: '❌ Enter a number between 1 and 100!' });
            continue;
          }
          game.attempts++;
          if (guess === game.number) {
            await sock.sendMessage(chatId, {
              text: `🎉 *Correct!*\n\nYou guessed it in ${game.attempts} attempts!\nThe number was ${game.number}!`
            });
            delete guessGame[chatKey];
          } else if (guess < game.number) {
            await sock.sendMessage(chatId, { text: `📈 Higher! Try again. (Attempt ${game.attempts})` });
          } else {
            await sock.sendMessage(chatId, { text: `📉 Lower! Try again. (Attempt ${game.attempts})` });
          }
          continue;
        }

        // ===== OWNER COMMANDS =====
        if (command === 'setprefix') {
          if (!isOwner(sender)) {
            await sock.sendMessage(chatId, { text: '❌ Owner only command!' });
            continue;
          }
          if (!args[0]) {
            await sock.sendMessage(chatId, { text: `❌ Usage: ${config.prefix}setprefix <new prefix>` });
            continue;
          }
          config.prefix = args[0];
          await sock.sendMessage(chatId, { text: `✅ Prefix changed to: ${config.prefix}` });
          continue;
        }

        if (command === 'setbotname') {
          if (!isOwner(sender)) {
            await sock.sendMessage(chatId, { text: '❌ Owner only command!' });
            continue;
          }
          if (!argText) {
            await sock.sendMessage(chatId, { text: `❌ Usage: ${config.prefix}setbotname <name>` });
            continue;
          }
          config.botName = argText;
          await sock.sendMessage(chatId, { text: `✅ Bot name changed to: ${config.botName}` });
          continue;
        }

        if (command === 'mode') {
          if (!isOwner(sender)) {
            await sock.sendMessage(chatId, { text: '❌ Owner only command!' });
            continue;
          }
          let mode = args[0]?.toLowerCase();
          if (mode !== 'public' && mode !== 'private') {
            await sock.sendMessage(chatId, {
              text: `❌ Usage: ${config.prefix}mode public/private\nCurrent: ${config.mode}`
            });
            continue;
          }
          config.mode = mode;
          await sock.sendMessage(chatId, { text: `✅ Mode changed to: ${mode.toUpperCase()}!` });
          continue;
        }

        if (command === 'broadcast') {
          if (!isOwner(sender)) {
            await sock.sendMessage(chatId, { text: '❌ Owner only command!' });
            continue;
          }
          if (!argText) {
            await sock.sendMessage(chatId, { text: `❌ Usage: ${config.prefix}broadcast <message>` });
            continue;
          }
          let chats = []; // store not available in this version
          let sent = 0;
          for (let cid of chats) {
            try {
              await sock.sendMessage(cid, {
                text: `📢 *Broadcast*\n\n${argText}\n\n— ${config.botName}`
              });
              sent++;
            } catch {}
          }
          await sock.sendMessage(chatId, { text: `✅ Broadcast sent to ${sent} chats!` });
          continue;
        }

        if (command === 'shutdown' || command === 'stop') {
          if (!isOwner(sender)) {
            await sock.sendMessage(chatId, { text: '❌ Owner only command!' });
            continue;
          }
          await sock.sendMessage(chatId, { text: `👋 ${config.botName} is shutting down...` });
          setTimeout(() => process.exit(0), 2000);
          continue;
        }

        // ===== UNKNOWN COMMAND =====
        if (text.startsWith(config.prefix) && command) {
          // Only respond for known prefixes, avoid spam
          let knownCmds = Object.keys(commands);
          if (!knownCmds.includes(command)) {
            // Silent ignore for unknown commands to avoid spam
          }
        }

      } catch (err) {
        console.error('Message handler error:', err);
      }
    }
  });

  return sock;
}

// ===== START =====
startBot().catch((err) => {
  console.error('Failed to start bot:', err);
  process.exit(1);
});

// ===== KEEP ALIVE =====
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

console.log(`\n${config.botName} ${config.version} starting up...`);
console.log(`Owner: +${config.owner} | Prefix: ${config.prefix} | Mode: ${config.mode}\n`);
