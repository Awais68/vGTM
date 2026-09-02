# OutReachKing — Setup Guide

## Prerequisites

- Node.js 18+ and npm
- Supabase project (free tier works)
- Resend account (for email)
- Anthropic API key (for AI features)
- HeyReach account (for LinkedIn automation)

## Step-by-step

```bash
# 1. Clone the repository
git clone <repo-url> && cd <repo-directory>

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env.local
```

Then edit `.env.local` and fill in all values:
- Supabase URL, anon key, and service role key
- PostgreSQL connection strings from your Supabase project
- Admin panel password (change from default!)
- Admin session salt (generate with `openssl rand -hex 32`)
- HeyReach API key
- Anthropic API key
- Resend API key and from-email

```bash
# 4. Generate Prisma client
npx prisma generate

# 5. Push schema to database
npx prisma db push

# 6. Start dev server
npm run dev
```

## Access

- **Admin panel**: Open `http://localhost:3000/admin` and sign in with the password set in `ADMIN_PANEL_PASSWORD`

## Production Build

```bash
npm run build
npm start
```

## Pre-commit Safety Hook

A pre-commit hook script is provided at `scripts/pre-commit-secrets-check.sh`. To enable it:

```bash
# Option A: Husky (recommended if husky is set up)
# Copy to .husky/pre-commit

# Option B: Manual git hook
cp scripts/pre-commit-secrets-check.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

This hook scans staged files for secrets (API keys, passwords) and blocks the commit if detected.
