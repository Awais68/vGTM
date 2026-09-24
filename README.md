# LinkedIn & Email Lead Automation (vGTM)

> AI-powered lead automation for LinkedIn and email. AI drafts every message,
> keeps score.

![Next.js](https://img.shields.io/badge/Next.js-000?style=flat&logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Status](https://img.shields.io/badge/Status-Feature%20Complete-brightgreen)
![Build](https://img.shields.io/badge/Build-Passing-brightgreen)
![Deploy](https://img.shields.io/badge/Production-Pending%20Setup-orange)

## What this does
- **Lead CRM** — import CSVs, assign leads to campaigns, track status
- **AI message engine** — personalized connection notes, follow-ups and
  emails per lead, tone- and context-aware (`lib/ai/message-engine.ts`)
- **Send Queue** — AI drafts land in a review list. You edit, copy, send in
  LinkedIn yourself, then log it back. The app never touches LinkedIn.
- **Sequences** — multi-step campaigns with per-step delays, driven by a cron
- **Analytics** — funnel, 30-day trend, per-step and per-campaign breakdowns,
  all derived from an append-only `Activity` log
- **Email** — real automated sending via Resend (with unsubscribe handling)

## Project status

**Code: feature complete.** `npx tsc --noEmit` and `npm run build` both pass.
**Production: not deployed yet** — it needs accounts and keys only the owner
can create (see *What's left* below).

### ✅ Completed

| Module | What works |
|---|---|
| Auth | Supabase email login, middleware gate, auto workspace on first login |
| Admin panel | `/admin` password login, AI / Resend / HeyReach keys per workspace |
| Lead import | CSV, XLSX, JSON, PDF, DOCX, paste — preview, mapping, history, needs-review |
| Lead CRM | Table, status, outcome logging, campaign assignment |
| Campaigns & sequences | Multi-step, per-step delays, launch without re-sending old steps |
| AI message engine | Per-lead connection notes, follow-ups, emails; rejects generic drafts; timeouts |
| Send Queue | Review / edit / copy / regenerate / skip / "I sent this" with daily caps |
| Email | Resend sending, retry + backoff, one-click unsubscribe, bounce/complaint webhook |
| Reply detection | Resend inbound → AI classifies intent → pauses or stops the sequence |
| LinkedIn senders | Sender accounts, optional HeyReach sync |
| Automation | Rules engine + hourly autopilot draft top-up |
| Analytics | Funnel, 30-day trend, per-step and per-campaign breakdowns |

### 🟢 Running (automated, once deployed)

| Job | Schedule | Does |
|---|---|---|
| `/api/cron/process-sequences` | every 15 min | Sends due emails, drafts LinkedIn steps into the queue. Rows are claimed first so overlapping runs never double-send |
| `/api/cron/autopilot` | hourly | Tops up AI drafts per automation rules |
| `/api/webhooks/resend` | on event | Marks bounces / complaints |
| `/api/webhooks/resend-inbound` | on event | Logs replies and pauses the sequence |

Locally: `npm run dev` → http://localhost:3000 (see Setup).

### ⏳ What's left (owner action, not code)

1. Supabase project → `DATABASE_URL`, `DIRECT_URL`, anon key → `npx prisma db push`
2. Resend: verify a sending (sub)domain, API key, webhooks → `RESEND_*`, `UNSUBSCRIBE_SECRET`
3. AI key (Gemini free tier is enough)
4. Vercel: import repo, add env vars, set `CRON_SECRET`; **Pro plan** for the 15-min cron
5. Custom domain → `NEXT_PUBLIC_APP_URL`, Supabase redirect URL
6. Run the launch checklist in [`requirements.md`](requirements.md) §8

Full step-by-step guide (Roman Urdu): [`requirements.md`](requirements.md).
Known limitations: `requirements.md` §9.

## How the LinkedIn flow works (human-in-the-loop)

There is no LinkedIn automation here, by design. Automated sending is what
gets accounts restricted, so the loop is:

1. **Launch a campaign** → leads get enrolled in its sequence.
2. **Cron** (`/api/cron/process-sequences`, every 15 min) reaches a LinkedIn
   step and writes a **DRAFT** into the Send Queue. It does not advance the
   sequence.
3. **You** open *LinkedIn → Send Queue*, read the draft, edit it if you want,
   hit **Copy text** and **Open profile**, and send it in LinkedIn yourself.
4. Back in the app, hit **I sent this**. Only now does the enrollment move to
   the next step, scheduled by that step's own `delayDays`.
5. When someone accepts or replies, log the outcome from the Leads table
   (**Log** column). Replies pause the sequence so the AI never talks over a
   live conversation.

Daily caps (Settings → *Daily caps*) are a brake on you, not a bypass of
anything: once you hit the cap for a channel, **I sent this** is disabled for
the rest of the day.

You can also generate drafts on demand from the Send Queue's *Generate*
panel — pick campaign, channel, step, tone and count.

## Setup

```bash
git clone https://github.com/Awais68/vGTM
cd vGTM
npm install
cp .env.example .env.local     # fill in DATABASE_URL + DIRECT_URL at minimum
npx prisma migrate deploy      # or: npx prisma db push
npm run dev
```

Running locally without Supabase auth: set `NEXT_PUBLIC_BYPASS_SETUP=true` in
`.env.local`. It skips login and auto-creates a workspace, and is refused when
`NODE_ENV=production`.

### AI keys (free path)
Set `AI_PROVIDER=GEMINI` and `AI_MODEL=gemini-2.0-flash` with a Google AI
Studio key — the free tier is enough for drafting. OpenRouter `:free` models
also work. See `.env.example` for the full list.

### Cron
`vercel.json` registers `/api/cron/process-sequences` at `*/15 * * * *`.
Set `CRON_SECRET` in the Vercel project; without it the route returns 401.

## Tech Stack
Next.js 15 · React 19 · TypeScript · Prisma · Supabase Postgres ·
Vercel AI SDK v6 · Resend · shadcn/ui · Recharts

`HEYREACH_API_KEY` is optional and unused by the Send Queue.
