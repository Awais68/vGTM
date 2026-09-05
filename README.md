# vGTM — AI-Powered Outreach System

> AI drafts every message. A human sends the LinkedIn ones. The dashboard
> keeps score.

![Next.js](https://img.shields.io/badge/Next.js-000?style=flat&logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Status](https://img.shields.io/badge/Status-Active%20Development-green)

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
