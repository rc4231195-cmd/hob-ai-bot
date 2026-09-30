# HOB Telegram AI

HOB Telegram AI is a production-ready Telegram bot powered by Google Gemini and deployed on Cloudflare Workers. It uses Cloudflare D1 for bounded conversation memory, Telegram webhook secret validation, duplicate-update protection, and safe handling of long AI responses.

## Features

- Telegram webhook endpoint at `POST /telegram/webhook`
- Health endpoint at `GET /health`
- Telegram webhook secret-token validation
- Manual Telegram Bot API client using `fetch`
- Google Gemini REST API client using `fetch`
- Commands: `/start`, `/help`, `/reset`, and `/about`
- Helpful response for unknown commands
- Conversation history stored in Cloudflare D1
- Configurable bounded history (20 messages by default)
- Atomic duplicate Telegram update detection
- Unicode-safe response chunking at approximately 4,000 characters
- Runtime environment validation
- Timeout and API error handling
- Safe user-facing errors without secrets or stack traces
- Strict TypeScript
- Vitest unit tests
- GitHub Actions CI and deployment workflow definitions

## Architecture

```text
                         ┌──────────────────┐
                         │     Telegram     │
                         │     Bot API      │
                         └────────┬─────────┘
                                  │
                           HTTPS Webhook
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │   Cloudflare Worker     │
                    │                         │
                    │  Webhook Verification   │
                    │          ↓              │
                    │    Update Router        │
                    │          ↓              │
                    │   Command / Message     │
                    │      Handlers           │
                    └───────┬─────────┬───────┘
                            │         │
                            ▼         ▼
                     ┌──────────┐ ┌──────────┐
                     │ Gemini   │ │ Cloudflare│
                     │ API      │ │ D1        │
                     └──────────┘ └──────────┘
                            │         │
                            └────┬────┘
                                 ▼
                         Telegram response
```

## Tech Stack

- **Telegram Bot API**: receives webhook updates and sends bot responses.
- **Cloudflare Workers**: runs the stateless webhook and request routing layer.
- **Cloudflare D1**: stores users, bounded messages, settings, and processed update IDs.
- **Google Gemini**: generates conversational responses from recent history and the current message.
- **TypeScript**: provides strict end-to-end types for Worker bindings, Telegram payloads, and Gemini requests.
- **Vitest**: runs unit tests without real Telegram, Gemini, or Cloudflare credentials.
- **Wrangler**: runs local development, D1 migrations, and Cloudflare deployment.

## Requirements

You need:

- A GitHub account
- A Telegram bot created with [@BotFather](https://t.me/BotFather)
- A Google AI/Gemini API key
- A Cloudflare account with Workers and D1 enabled
- Node.js 20.3 or newer
- npm
- Wrangler (installed through this project's dev dependencies)

## Installation

```bash
git clone https://github.com/rc4231195-cmd/hob-ai-bot.git
cd hob-ai-bot
npm install
```

## Environment

Copy the example environment file for local development:

```bash
cp .env.example .dev.vars
```

Fill in your own local values. Never commit `.env` or `.dev.vars`.

```dotenv
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
```

`TELEGRAM_WEBHOOK_SECRET` should be a long random string that only you and Telegram know.

For production, store secrets in Cloudflare:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put GEMINI_MODEL
```

Do not paste real credentials into source files, README files, issues, pull requests, or chat messages.

## Cloudflare D1

Create the database:

```bash
npx wrangler d1 create hob-db
```

Cloudflare prints a real `database_id`. Replace the all-zero placeholder in `wrangler.jsonc`:

```jsonc
{
  "binding": "DB",
  "database_name": "hob-db",
  "database_id": "YOUR_REAL_DATABASE_ID"
}
```

Apply the remote migration:

```bash
npx wrangler d1 migrations apply hob-db --remote
```

For a local D1 database:

```bash
npm run db:migrate:local
```

## Local Development

Start the Worker locally:

```bash
npm run dev
```

Wrangler prints a local URL. Telegram webhooks require a public HTTPS URL, so use a secure tunnel or deploy to Cloudflare before configuring Telegram.

Useful checks:

```bash
npm run typecheck
npm test
```

## Deployment

Verify the project:

```bash
npm run typecheck
npm test
```

Deploy:

```bash
npm run deploy
```

Deployment requires:

- A valid Cloudflare API token
- A Cloudflare account ID
- A real D1 `database_id` in `wrangler.jsonc`
- Production secrets configured with `wrangler secret put`

## Telegram Webhook

After deployment, configure Telegram to call:

```text
https://YOUR-WORKER-SUBDOMAIN.workers.dev/telegram/webhook
```

Use the Telegram `setWebhook` API with the same secret configured as `TELEGRAM_WEBHOOK_SECRET`:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "content-type: application/json" \
  -d '{
    "url": "https://YOUR-WORKER-SUBDOMAIN.workers.dev/telegram/webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message"]
  }'
```

Replace the placeholders locally. Do not commit the resulting command or URL if it contains credentials.

## GitHub Actions

The complete workflow definitions are included in:

- `workflow-templates/ci.yml` — typechecks and tests pull requests and pushes to `main`
- `workflow-templates/deploy.yml` — verifies the project, then deploys to Cloudflare Workers

They are stored as templates because the GitHub authorization used to build this repository did not include the `workflow` scope required to write `.github/workflows/`. After granting that scope or using your own GitHub account, copy them into place:

```bash
mkdir -p .github/workflows
cp workflow-templates/ci.yml .github/workflows/ci.yml
cp workflow-templates/deploy.yml .github/workflows/deploy.yml
```

Configure these GitHub repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Cloudflare application secrets are managed separately with Wrangler and are not stored in GitHub Actions YAML.

## Security

- Telegram webhook requests must include `X-Telegram-Bot-Api-Secret-Token`.
- Invalid webhook secrets receive HTTP 401.
- Non-POST webhook requests are rejected.
- Incoming update JSON is validated before processing.
- Telegram update IDs are recorded atomically to prevent duplicate Gemini calls and duplicate replies.
- Conversation history is bounded by `HISTORY_LIMIT`.
- Telegram responses are split into safe chunks before sending.
- API keys and bot tokens are never returned to users.
- Logs avoid message contents, authorization headers, and secret values.
- User-facing errors are generic and do not expose database details or stack traces.
- External Telegram and Gemini calls are isolated in their own client modules.

## Commands

| Command | Description |
| --- | --- |
| `/start` | Shows a friendly introduction and explains that the bot uses Gemini. |
| `/help` | Lists commands and explains normal chat usage. |
| `/reset` | Deletes the user's stored conversation context. |
| `/about` | Shows bot and project information. |

Unknown commands receive a short message directing the user to `/help`.

## Project Structure

```text
hob-ai-bot/
│
├── workflow-templates/
│   ├── ci.yml
│   └── deploy.yml
│
├── migrations/
│   └── 0001_initial.sql
│
├── src/
│   ├── config/
│   │   └── constants.ts
│   │
│   ├── gemini/
│   │   ├── client.ts
│   │   └── types.ts
│   │
│   ├── telegram/
│   │   ├── api.ts
│   │   ├── types.ts
│   │   └── webhook.ts
│   │
│   ├── router/
│   │   └── update-router.ts
│   │
│   ├── handlers/
│   │   ├── commands.ts
│   │   └── message.ts
│   │
│   ├── services/
│   │   ├── conversation.ts
│   │   └── user.ts
│   │
│   ├── utils/
│   │   ├── chunk.ts
│   │   ├── errors.ts
│   │   └── validation.ts
│   │
│   ├── env.d.ts
│   └── index.ts
│
├── tests/
│   ├── chunk.test.ts
│   ├── conversation.test.ts
│   ├── gemini.test.ts
│   ├── router.test.ts
│   └── validation.test.ts
│
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── wrangler.jsonc
├── LICENSE
└── README.md
```

## Troubleshooting

### Webhook not receiving updates

- Confirm the Worker is deployed and `GET /health` returns `{ "ok": true }`.
- Check Telegram's webhook URL with `getWebhookInfo`.
- Confirm the webhook URL ends with `/telegram/webhook`.
- Confirm the Telegram `secret_token` exactly matches `TELEGRAM_WEBHOOK_SECRET`.
- Check Cloudflare Worker logs for validation or D1 errors.

### Gemini API errors

- Confirm `GEMINI_API_KEY` is configured as a Cloudflare secret.
- Confirm `GEMINI_MODEL` names an available Gemini model.
- Check Google AI quota, billing, and rate limits.
- The bot returns a generic user-facing error instead of exposing provider details.

### D1 errors

- Confirm the D1 database exists: `npx wrangler d1 list`.
- Confirm `wrangler.jsonc` uses the real database ID.
- Apply migrations: `npm run db:migrate:remote`.
- Confirm the Worker binding name is exactly `DB`.

### Missing secrets

Run:

```bash
npx wrangler secret list
```

Add missing values with `npx wrangler secret put <NAME>`.

### Deployment problems

- Confirm GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` exist.
- Confirm the Cloudflare token can edit Workers and access D1 in the target account.
- Run `npm run typecheck`, `npm test`, and `npx wrangler deploy --dry-run` locally.
- Check whether the all-zero D1 placeholder ID has been replaced.

## Roadmap

Possible future features:

- Streaming responses
- Image understanding
- Voice messages
- Admin commands
- Rate limiting
- Analytics
- Multiple AI providers
- Configurable personas

## License

MIT
