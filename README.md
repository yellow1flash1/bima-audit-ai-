# Bima Audit

Discharge-desk auditor for Indian health-insurance bills: checks every TPA
deduction against IRDAI Lists I–IV and the proportionate-deduction rules, and
produces a rule-cited English / हिन्दी rebuttal.

**Live demo:** https://bima-audit.vercel.app (runs on fictional sample cases in your browser).

Stack: Next.js 15, TypeScript, Tailwind CSS, Supabase (Postgres, Auth, Storage), Claude for
reading bills. Blueprint: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

> All hospitals, insurers, TPAs and patients in the sample data are fictional. IRDAI circular
> references need checking against the current publication before real use. This software
> is not legal or insurance advice.

## Run

Without Supabase env vars the app runs on in-browser demo cases. With them it signs
users in and reads/writes through Supabase under RLS.

```bash
npm install
npx supabase start          # needs Docker; applies migrations + seeds
npx supabase status         # copy API URL, anon key, service-role key into .env.local (see .env.example)
npm run dev                 # http://localhost:3000
```

Bill reading calls Claude (`claude-opus-5-5`) through `@anthropic-ai/sdk`, so the
server needs an Anthropic credential: `ANTHROPIC_API_KEY` in `.env.local`, or an
`ant auth login` profile. Without one, uploads are still stored and the app says
reading isn't set up. To try the review flow with no key, set `BIMA_FAKE_OCR=1`
(development only) for a canned bill.

Local test accounts (`desk@bima.test`, `manager@bima.test`, `family@bima.test`) are
created by `supabase/seed/demo.sql`; the password is in `scripts/demo-accounts.ts`. It's
public in this repo, so it's for a local Supabase only: never load `demo.sql` into a hosted
project (for a hosted demo, generate a seed with your own `DEMO_PASSWORD`, see `scripts/gen-demo-seed.ts`).
`family@` is bound to case BA-24117; the desk can share other cases with
**Share with Family** (single-use, 24-hour link).

```bash
npm test                    # unit: engine, bill reader (mocked model), PII scrubber, magic bytes, rate limit, hash chain, i18n
npm run test:it             # integration: RLS, JWT claims, column grants, audit chain, claim tokens, storage
npm run db:reset            # re-apply migrations and seeds
npm run seed:gen            # regenerate both seed files from src/lib/rules-engine/catalogue.ts + src/lib/demo/cases.ts
```

## How the pieces fit

| Concern | Where |
|---|---|
| JWT `hospital_id` / `app_role` claims | `custom_access_token_hook` (migration 0002), enabled in `supabase/config.toml` |
| Session refresh, sign-in redirect | `src/middleware.ts`, `src/app/login`, `src/app/auth/callback` |
| Reads/writes as the user (RLS) | `src/lib/data/supabase-backend.ts` (demo twin: `src/lib/data/demo-backend.ts`) |
| Flags and payable ₹ | Only `POST /api/cases/[id]/evaluate` (service role, after an RLS access check); `authenticated` has no column grant on them |
| Audit chain | `events` trigger hashes UTC-formatted `created_at`; `case_events()` returns the exact hashed strings; verified in the browser |
| Uploads | Browser → private `bills` bucket at `{hospital}/{case}/{uuid}.ext` + `documents` row (avoids Vercel's 4.5 MB body limit); `/api/scan` re-checks the bytes by document id; `/api/documents/[id]` issues 60-second signed URLs |
| Family access | `issue_claim_token` / `claim_case` RPCs; tokens stored as HMAC with a key the API can't read |
| Bill reading | `/api/scan` → `src/lib/ai/bill-reader.ts`. Text PDFs: text layer extracted, PII-scrubbed, fenced in `<untrusted_bill_ocr>`; scanned PDFs refused (photo instead, so the header can be blurred); photos sent as images after on-device blurring. Output is structured, re-validated with bounds, PII-scrubbed again, never sets flags or ₹ |
| Review before adding | `ReviewSheet` shows each suggested line with read confidence plus warnings (injected instructions, printed-total mismatch, hard-to-read lines); ticked lines go to `/api/cases/[id]/lines` (desk only), then the engine re-evaluates |

## Status

| Area | State |
|---|---|
| Rules engine, security libs, UI | Done (increment 1) |
| Supabase | Done (increment 2): auth, RLS, claims hook, engine-only columns, hash chain, storage, claim links. Verified against local Supabase |
| Bill reading | Done (increment 3). Tested with a mocked model and the dev fake reader; not yet run against the real API (no key on this machine) |
| Rate limiter | In-memory per instance; needs a shared store for multi-instance deploys |

To go to a hosted project: `npx supabase link`, `npx supabase db push`, enable the
custom access token hook in the dashboard (Auth → Hooks), and set the three env vars.
Don't load `seed/demo.sql` there. Circular references in `catalogue.ts` should be
checked against the current IRDAI publication before go-live.
