# vGTM — Production Requirements (Roman Urdu Guide)

Yeh file batati hai ke vGTM ko production (Vercel + Supabase + Resend) par
chalane ke liye kya kya chahiye, kis order mein set karna hai, aur launch se
pehle kya verify karna hai. Har section ke aakhir mein ek checklist hai.

Technical terms English mein hain, explanation Roman Urdu mein.

---

## 1. Overview: app kya karti hai

- **Leads** import hoti hain (CSV, XLSX, JSON, PDF, DOCX, paste).
- **AI** har lead ke liye LinkedIn connection note, follow-up, ya email draft karta hai.
- **LinkedIn**: app kabhi LinkedIn ko touch nahi karti. Draft Send Queue mein aata hai,
  aap copy kar ke LinkedIn mein khud bhejte hain, phir "I sent this" dabate hain.
- **Email**: Resend ke through app khud bhejti hai (Send Queue ka "Send email" button,
  ya sequence cron se).
- **Cron** har 15 minute sequences aage badhata hai; har ghante autopilot drafts top-up karta hai.
- **Analytics** Activity log se banti hain.

---

## 2. Accounts jo chahiye

| Service   | Kis liye                               | Plan                     |
|-----------|----------------------------------------|--------------------------|
| Vercel    | Hosting + cron jobs                    | Hobby chalega, Pro better |
| Supabase  | Postgres database + login (auth)       | Free tier kaafi hai      |
| Resend    | Email bhejne aur reply receive karne   | Free 3k/month, verified domain zaroori |
| AI provider | Drafting (Gemini / OpenRouter / OpenAI) | Gemini free tier kaafi |
| HeyReach  | Optional. LinkedIn sender accounts sync aur lead push | Paid, optional |

---

## 3. Environment variables (sab se important)

Vercel Dashboard → Project → Settings → Environment Variables mein yeh set karo.
`Production` aur `Preview` dono environments mein add karo jahan zaroorat ho.

### 3.1 Required (in ke baghair app boot nahi hogi ya login toot jayega)

| Variable | Kahan se milega | Note |
|---|---|---|
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string (**Transaction pooler**, port 6543) | Aakhir mein `?pgbouncer=true` lagao |
| `DIRECT_URL` | Same jagah, **Session / Direct** connection (port 5432) | `prisma db push` isi ko use karta hai |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | Client par expose hota hai, secret nahi |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page → `anon` `public` key | Secret nahi |
| `NEXT_PUBLIC_APP_URL` | Aapka live domain, e.g. `https://app.yourdomain.com` | Unsubscribe links aur signup confirm link isi par bante hain. Trailing slash mat lagao |
| `CRON_SECRET` | Khud generate karo: `openssl rand -hex 32` | Vercel cron automatically `Authorization: Bearer <CRON_SECRET>` bhejta hai. Set nahi hoga to cron 401 dega |
| `ADMIN_PANEL_PASSWORD` | Khud rakho, strong | `/admin` panel ka password |
| `ADMIN_SESSION_SALT` | `openssl rand -hex 32` | Admin cookie sign karne ke liye |

### 3.2 Email ke liye required (agar koi bhi EMAIL step ya email draft use karna hai)

| Variable | Kahan se milega | Note |
|---|---|---|
| `RESEND_API_KEY` | Resend → API Keys | Admin Panel se bhi per-workspace set ho sakti hai; env fallback hai |
| `RESEND_FROM_EMAIL` | Aapke **verified** Resend domain ka address, e.g. `awais@outreach.yourdomain.com` | Campaign ka apna `fromEmail` ho to woh override karta hai |
| `RESEND_WEBHOOK_SECRET` | Resend → Webhooks → apne webhook ka Signing Secret (`whsec_...`) | Bounce/complaint aur inbound reply webhooks isi se verify hote hain |
| `UNSUBSCRIBE_SECRET` | `openssl rand -hex 32` | **Production mein zaroori hai.** Set nahi hoga to email send fail hogi (jaan boojh kar, warna koi bhi unsubscribe token forge kar sakta hai) |

### 3.3 AI ke liye (kam az kam ek path)

Option A — Admin Panel se (recommended): `/admin` → Settings → AI provider + key save karo.
Option B — env fallback:

| Variable | Value |
|---|---|
| `AI_PROVIDER` | `GEMINI` \| `OPENROUTER` \| `OPENAI` |
| `AI_API_KEY` | Provider ki key |
| `AI_MODEL` | Optional. Khali chhodo to default (`gemini-2.0-flash`, `google/gemini-2.0-flash-exp:free`, `gpt-4o-mini`) |

### 3.4 Optional

| Variable | Note |
|---|---|
| `HEYREACH_API_KEY` | Sirf tab jab HeyReach se sender accounts sync ya leads push karni hon. Admin Panel se bhi set ho sakti hai |
| `NEXT_PUBLIC_BYPASS_SETUP` | **Production mein kabhi set na karo.** Sirf local dev mein `true`; code production mein ise ignore karta hai |

---

## 4. Supabase setup

1. **Project banao** aur `DATABASE_URL` / `DIRECT_URL` note karo.
2. **Schema push karo** (repo mein migrations folder nahi hai, `db push` use hota hai):
   ```bash
   npx prisma db push
   ```
   Yeh local se chalao, `.env.local` mein production `DIRECT_URL` daal kar. Har schema change par dobara.
3. **Auth settings** → Authentication → URL Configuration:
   - **Site URL**: `https://app.yourdomain.com`
   - **Redirect URLs** mein add karo: `https://app.yourdomain.com/auth/callback`
     (Preview deployments ke liye `https://*.vercel.app/auth/callback` bhi add kar sakte ho.)
4. **Email provider**: Authentication → Providers → Email enabled rakho.
   "Confirm email" on hai to signup ke baad user ko email se confirm karna hoga.
   Agar sirf aap use kar rahe ho to isay off kar do, login foran chalega.
5. **Pehla user**: `/login` par jao → Sign up. Pehli login par app khud
   Workspace + User + Settings bana deti hai. Alag se kuch insert karne ki zaroorat nahi.

> Note: Supabase RLS is app par apply nahi hota, kyunke Prisma direct Postgres
> connection use karta hai. Tenant isolation app code mein `workspaceId` se hoti hai.

---

## 5. Resend setup (email)

1. **Domain verify karo**: Resend → Domains → Add domain → DNS mein SPF, DKIM (aur DMARC) records lagao.
   Cold outreach ke liye **main domain use na karo**; ek alag subdomain ya sister domain
   (e.g. `outreach.yourdomain.com`) rakho taake main domain ki reputation safe rahe.
2. **API key** banao → `RESEND_API_KEY`.
3. **Webhooks** → Add Endpoint:
   - URL: `https://app.yourdomain.com/api/webhooks/resend`
   - Events: `email.bounced`, `email.complained`
   - Signing secret → `RESEND_WEBHOOK_SECRET`
4. **Inbound (replies)** — agar chahte ho ke reply aane par sequence khud ruk jaye:
   - Resend → Receiving enable karo, `RESEND_FROM_EMAIL` wale domain par MX record lagao.
   - Dusra webhook: URL `https://app.yourdomain.com/api/webhooks/resend-inbound`, event `email.received`.
   - Dono webhooks ka signing secret same `RESEND_WEBHOOK_SECRET` hona chahiye
     (code ek hi variable padhta hai). Agar Resend alag secrets de to ek endpoint par dono events subscribe karo.
5. **Resend ki policy**: Resend transactional provider hai. Bulk cold email par account
   suspend ho sakta hai. Chhoti, targeted, opt-out wali campaigns theek hain; volume
   cold email ke liye Instantly/Smartlead jaisa tool lagao (dekho section 9).

---

## 6. Vercel deploy

1. Repo import karo → Framework: Next.js (auto-detect).
2. Section 3 ke saare env vars add karo.
3. `vercel.json` mein cron pehle se registered hai:
   - `/api/cron/process-sequences` — har 15 min
   - `/api/cron/autopilot` — har ghante
   Vercel Hobby plan par cron **din mein sirf ek baar** chalta hai; 15-min cron ke liye **Pro** chahiye.
4. Deploy karo. Build TypeScript/ESLint errors ignore karta hai (`next.config.mjs`), isliye
   deploy se pehle local `npx tsc --noEmit` chala lo.
5. Deploy ke baad **custom domain** attach karo aur `NEXT_PUBLIC_APP_URL` usi par set karo, phir redeploy.

---

## 7. Pehli baar chalane ka order

1. `/login` → Sign up → (email confirm) → Sign in.
2. `/admin` → password → AI provider + key, Resend key (agar env mein nahi), HeyReach key (optional).
3. App → Settings → Sender name, title, default offer context, daily caps, timezone.
4. LinkedIn → Sender accounts → apna profile add karo (sirf naam/URL, koi password nahi).
5. Campaign banao → offer context, from name, from email (verified domain) → Sequence steps.
   - Email step ka template `{{ai}}` rakho to AI har lead ke liye alag email likhta hai
     (company, role, industry, aur import ki extra columns ko use kar ke). Yeh recommended hai.
   - Generic email rule: AI draft mein lead ki company/role/industry ka zikr lazmi hai. Agar draft
     generic nikle to ek retry hoti hai, phir bhi generic ho to draft fail hota hai (queue mein
     "failures" mein dikhega, sequence 30 min baad retry karegi). Lead data jitna zyada hoga
     (website, notes, tech stack columns), email utni specific banegi.
   - Fixed template chahiye to `{{firstName}}`, `{{company}}`, `{{jobTitle}}` tags use karo.
6. Leads import → campaign select → Launch.
7. Send Queue → LinkedIn drafts copy kar ke bhejo → "I sent this". Email drafts par "Send email".
8. Jab koi accept/reply kare → Leads → Log outcome. Reply par sequence khud pause hoti hai.

---

## 8. Launch se pehle verify karo (checklist)

- [ ] `npx prisma db push` production DB par chal chuka hai
- [ ] `/login` khulta hai, signup → confirm → sign in kaam karta hai, `/` dashboard dikhta hai
- [ ] `/admin` password se khulta hai, keys save hoti hain
- [ ] Cron test: `curl -H "Authorization: Bearer $CRON_SECRET" https://app.yourdomain.com/api/cron/process-sequences` → `{"success":true,...}`
      (Bina header ke 401 aana chahiye, redirect nahi)
- [ ] Resend webhook test: Resend dashboard se "Send test event" → 200
- [ ] Ek test lead ko apna email de kar email step chalao → email aaye, footer mein Unsubscribe link ho
- [ ] Unsubscribe link kholo → confirm page aaye (seedha unsubscribe na ho) → button dabao → lead `NOT_INTERESTED`
- [ ] Gmail/Outlook mein email ke headers mein `List-Unsubscribe` dikhe
- [ ] Send Queue mein EMAIL item par "Send email" dabao → Resend logs mein delivery dikhe
- [ ] Campaign dobara Launch karo → `alreadyEnrolled` count aaye, duplicate email na jaye
- [ ] `NEXT_PUBLIC_BYPASS_SETUP` production env mein **nahi** hai
- [ ] `.env`, `.env.local`, `.env.bak.*` git mein nahi hain (`git ls-files | grep env` sirf `.env.example` dikhaye)

---

## 9. Known limitations / abhi bhi pending

Yeh cheezein code mein abhi theek nahi hain. Production use se pehle in par faisla lo.

**Security**
- `/api/ai/test` aur `/api/heyreach/verify` bina login ke accessible hain (server ko key-check proxy bana sakte hain). Rate limiting kahin nahi hai.
- Admin password par brute-force limit nahi. Admin cookie password/salt change hone tak valid rehti hai.
- API keys database mein plaintext hain (`WorkspaceSetting`). Supabase DB access ko tightly control karo.
- Inbound reply webhook lead ko sirf email se dhoondta hai, workspace-scoped nahi; email body seedha AI classifier mein jati hai (prompt injection se status galat ho sakta hai).
- HeyReach leads route (`/api/heyreach/campaigns/[id]/leads`) campaign ko workspace ke baghair dhoondta hai.
- Admin Panel sirf **pehle** workspace ki keys set karta hai. Multi-tenant use ke liye theek nahi.

**Functional**
- Email template (`emails/OutreachEmail.tsx`) khud "Hi {firstName}," aur signature lagata hai; AI draft mein greeting ho to double ho jayegi.
- Follow-up emails thread nahi hoti (koi `In-Reply-To` header nahi), har email alag dikhti hai.
- Cron par lock nahi; agar ek run 15 min se lamba chale to overlap mein duplicate send possible hai.
- Reply detection Resend inbound par depend karti hai; `from` field format match na ho to reply detect nahi hogi.

**Deliverability (cold email ke liye)**
- Warm-up, inbox rotation, daily email caps kuch nahi hai. Serious cold email ke liye Instantly / Smartlead API ya Gmail/Outlook OAuth sending layer lagao aur Resend sirf transactional ke liye rakho.

---

## 10. Local development

```bash
cp .env.example .env.local
# DATABASE_URL, DIRECT_URL lazmi; baaki optional
# Login skip karne ke liye: NEXT_PUBLIC_BYPASS_SETUP=true
npx prisma db push
npm run dev
```

Cron local par test karne ke liye:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/process-sequences
```
