<p align="center">
  <img src="public/images/opsicos_logo.avif" alt="Opsicos Logo" width="120" />
</p>

<h1 align="center">Opsicos</h1>

<p align="center">
  <b>Create, deploy, and manage AI-powered Discord bots — no coding required.</b>
</p>

<p align="center">
  <a href="#-features"><img src="https://img.shields.io/badge/AI%20Models-35%2B-blueviolet?style=for-the-badge" alt="AI Models" /></a>
  <a href="#-tech-stack"><img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" /></a>
  <a href="#-tech-stack"><img src="https://img.shields.io/badge/MongoDB-6%2B-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" /></a>
  <a href="#-tech-stack"><img src="https://img.shields.io/badge/Discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord.js" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" /></a>
</p>

---

## 📖 Overview

**Opsicos** is an advanced platform that lets users create and manage multiple Discord bots powered by leading AI models. Users authenticate via Discord OAuth, provide their own bot tokens, select from 35+ AI models, configure advanced behavior settings, and deploy production-ready bots — all through an intuitive web dashboard.

Each bot runs inside a shared Node.js process with enterprise-grade features like single-instance enforcement, automatic health checks, rate-limit management, and graceful shutdown handling.

---

## ✨ Features

| Category | Details |
|---|---|
| 🤖 **Bot Management** | Create, configure, start, stop, and monitor multiple Discord bots from a single dashboard |
| 🧠 **35+ AI Models** | Choose from OpenAI, DeepSeek, Google, Meta, Mistral, Qwen, xAI, Anthropic, and more |
| 💬 **Smart Conversations** | Conversation memory, per-bot knowledge base, custom personality & tone settings |
| 🎭 **Behavior Engine** | Typing simulation, emoji usage, occasional typos, mood simulation, dad jokes mode |
| 🔐 **Discord OAuth** | Secure authentication with auto-join to your Discord server |
| 📊 **Real-time Dashboard** | Live bot status via Socket.io, uptime tracking, server counts, response times |
| 🎫 **Ticket System** | Built-in support ticket system with categories, transcripts, and admin management |
| 🛡️ **Admin Panel** | User management, ban system (IP + email), login logs, security monitoring |
| 📧 **Contact System** | Configurable email notifications via SMTP/Gmail |
| 🔄 **Auto-Recovery** | Health checks every 2 minutes, automatic bot restart on failure |
| 🌐 **Multi-Language** | English, Hindi, French, Spanish, Chinese, Russian, Japanese, Filipino, Bangla, Polish |
| 📱 **Android App** | Companion Android application (under `android-app/`) |

---

## 🧠 Supported AI Models

<details>
<summary><b>View all 35+ models organized by provider</b></summary>

| Provider | Models |
|---|---|
| **OpenAI** | GPT-4o Mini, GPT-5 Nano, GPT OSS 20B, GPT-4.1 Nano |
| **DeepSeek** | V3.1, V3.1 Turbo, R1 Distill Qwen 1.5B, TNG R1T2 Chimera |
| **Google** | Gemma 3 4B IT, Gemini 2.5 Flash Lite Preview, Gemma 3 27B Instruct, Gemma 2 9B IT |
| **Meta** | Llama 4 Scout (17B 16E), Llama 4 Scout, Llama 3.2 1B Instruct, DeepHermes 3, Shisa V2 |
| **Mistral** | Nemo 12B Instruct, Devstral Small 2505, Small 3.2 24B Instruct |
| **MoonShot AI** | Kimi K2 Instruct, Kimi VL A3B Thinking |
| **Qwen** | Qwen3 4B Thinking, Qwen2.5 7B Instruct, Qwen3 8B, Qwen 2.5 72B |
| **xAI** | Grok 4 0709 |
| **Zhipu AI** | GLM 4.6, GLM 4.5V |
| **InferenceNet** | ClipTagger 12B |
| **Anthropic** | Claude 3.7 Sonnet (via custom router) |

</details>

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐             │
│  │  Web UI  │  │ Android App  │  │  Discord API  │             │
│  │ (Static) │  │   (Mobile)   │  │  (Gateway)    │             │
│  └────┬─────┘  └──────┬───────┘  └───────┬───────┘             │
└───────┼────────────────┼──────────────────┼─────────────────────┘
        │                │                  │
┌───────┼────────────────┼──────────────────┼─────────────────────┐
│       ▼                ▼                  ▼                      │
│  ┌─────────────────────────────────────────────┐                │
│  │          Express.js + Socket.io              │                │
│  │  ┌───────┐ ┌──────┐ ┌──────┐ ┌───────────┐ │                │
│  │  │ Auth  │ │ Bots │ │ Admin│ │ Knowledge │ │                │
│  │  │Routes │ │Routes│ │Panel │ │  Routes   │ │                │
│  │  └───────┘ └──────┘ └──────┘ └───────────┘ │                │
│  └──────────────────┬──────────────────────────┘                │
│                     │                                            │
│  ┌──────────────────┼──────────────────────────┐                │
│  │           Service Layer                      │                │
│  │  ┌────────────────┐  ┌───────────────────┐  │                │
│  │  │DiscordBotSvc   │  │  A4F AI Service   │  │                │
│  │  │ (User Bots)    │  │  (Model Routing)  │  │                │
│  │  ├────────────────┤  ├───────────────────┤  │                │
│  │  │OfficialBotSvc  │  │  Email Service    │  │                │
│  │  │ (Platform Bot) │  │  Webhook Service  │  │                │
│  │  └────────────────┘  └───────────────────┘  │                │
│  └──────────────────┬──────────────────────────┘                │
│                     │                                            │
│  ┌──────────────────┼──────────────────────────┐                │
│  │         Data Layer (MongoDB)                 │                │
│  │  User │ Bot │ Knowledge │ MessageHistory     │                │
│  │  BotSmartness │ Ticket │ BanList │ LoginLog  │                │
│  └─────────────────────────────────────────────┘                │
│                  Application Server                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 18+ |
| **Framework** | Express.js |
| **Database** | MongoDB (Mongoose ODM) |
| **Authentication** | Passport.js + Discord OAuth2 |
| **Discord** | discord.js v14 |
| **Real-time** | Socket.io |
| **AI Gateway** | A4F API + custom provider integrations |
| **Email** | Nodemailer |
| **Frontend** | Static HTML/CSS/JS (no framework) |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **MongoDB** (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- **Discord Application** ([Developer Portal](https://discord.com/developers/applications))
- **A4F API Key** ([a4f.co](https://a4f.co)) — or another OpenAI-compatible provider

### 1. Clone the Repository

```bash
git clone https://github.com/mynameuwu9-del/opsicos.git
cd opsicos
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in the **required** values:

| Variable | Description |
|---|---|
| `DISCORD_CLIENT_ID` | Your Discord application's Client ID |
| `DISCORD_CLIENT_SECRET` | Your Discord application's Client Secret |
| `DISCORD_CALLBACK_URL` | OAuth2 redirect URI (e.g., `http://localhost:3000/auth/discord/callback`) |
| `MONGODB_URI` | MongoDB connection string |
| `SESSION_SECRET` | Random string for signing cookies |
| `ADMIN_PASSWORD` | Password for the admin panel |
| `A4F_PRIMARY_API_KEY` | API key for the AI model provider |

> **💡 Tip:** Generate a session secret with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### 4. Set Up Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a **New Application**
3. Under **OAuth2 → General**:
   - Add your redirect URL (e.g., `http://localhost:3000/auth/discord/callback`)
4. Under **Bot**:
   - Enable **Server Members Intent**
   - Enable **Message Content Intent**
5. Copy the **Client ID**, **Client Secret**, and **Bot Token** into your `.env`

### 5. Run the Application

**Development** (with auto-restart):
```bash
npm run dev
```

**Production**:
```bash
npm start
```

The application will be available at `http://localhost:3000`.

---

## 📁 Project Structure

```
opsicos/
├── app.js                    # Application entry point & server setup
├── package.json              # Dependencies & scripts
├── .env.example              # Environment variable template
│
├── public/                   # Static frontend files
│   ├── index.html            # Landing page
│   ├── dashboard.html        # User dashboard
│   ├── admin-panel.html      # Admin management panel
│   ├── login.html            # Discord OAuth login
│   ├── docs.html             # API documentation
│   ├── playground.html       # API testing playground
│   ├── bot-smartness.html    # Bot behavior configuration
│   ├── knowledge.html        # Knowledge base editor
│   ├── settings.html         # User settings
│   ├── status.html           # System status page
│   ├── css/                  # Stylesheets
│   ├── js/                   # Client-side JavaScript
│   └── images/               # Static assets
│
├── src/
│   ├── config/
│   │   ├── database.js       # MongoDB connection
│   │   ├── passport.js       # Discord OAuth strategy
│   │   └── rateLimits.js     # Rate limiting configuration
│   │
│   ├── middleware/
│   │   ├── auth.js           # Authentication & ban checking
│   │   └── maintenanceMode.js# Maintenance mode gate
│   │
│   ├── models/               # Mongoose schemas
│   │   ├── User.js           # User accounts
│   │   ├── Bot.js            # Bot configurations
│   │   ├── BotSmartness.js   # Bot behavior settings
│   │   ├── Knowledge.js      # Knowledge base entries
│   │   ├── MessageHistory.js # Conversation memory
│   │   ├── Ticket.js         # Support tickets
│   │   ├── BanList.js        # Banned users/IPs
│   │   └── ...               # Additional models
│   │
│   ├── routes/               # Express route handlers
│   │   ├── auth.js           # /auth — OAuth flow
│   │   ├── bots.js           # /bots — Bot CRUD & lifecycle
│   │   ├── api.js            # /api — REST API
│   │   ├── admin.js          # /admin — Admin panel
│   │   ├── knowledge.js      # /knowledge — Knowledge CRUD
│   │   ├── smartness.js      # Bot intelligence settings
│   │   └── ...               # Additional routes
│   │
│   ├── services/             # Business logic
│   │   ├── discordBotService.js    # Core bot lifecycle manager (~2500 lines)
│   │   ├── a4fService.js           # AI model routing & API gateway
│   │   ├── officialBotService.js   # Platform slash commands & tickets
│   │   ├── ticketService.js        # Support ticket system
│   │   ├── emailService.js         # SMTP email sending
│   │   ├── webhookService.js       # Discord webhook notifications
│   │   └── ...                     # Additional services
│   │
│   └── utils/                # Utility modules
│       ├── instanceManager.js      # Single-instance enforcement
│       ├── deploymentManager.js    # Rate limit & session persistence
│       └── transcriptGenerator.js  # Ticket transcript generation
│
└── android-app/              # Android companion app
```

---

## ⚙️ Available Scripts

| Command | Description |
|---|---|
| `npm start` | Start the production server |
| `npm run dev` | Start with nodemon (auto-restart on changes) |
| `npm run force-restart` | Clear instance locks and restart |

---

## 🔑 How It Works

1. **Authenticate** — Users log in with their Discord account via OAuth2
2. **Add Bot Token** — Provide a Discord bot token from the Developer Portal
3. **Choose AI Model** — Select from 35+ AI models across 10+ providers
4. **Configure Behavior** — Set personality, tone, language, smartness level, and custom rules
5. **Deploy** — Start the bot with one click; it connects to Discord instantly
6. **Interact** — Use `/chat` commands or mention the bot in any server it's in

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <sub>Built with ❤️ by the Opsicos Team</sub>
</p>
