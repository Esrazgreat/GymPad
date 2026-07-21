# GymPad · ጂምፓድ

**Your pocket gym. 100% free — no locked features.**

A bilingual (Amharic + English) fitness app for the Ethiopian market. AI screens
your health intake, builds a phased training plan around your body, equipment and
schedule, then coaches you through every session.

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  React/Vite  │─────▶│  Express API │─────▶│   Supabase   │
│   (Vercel)   │      │   (Render)   │      │  Postgres +  │
└──────────────┘      └──────┬───────┘      │     Auth     │
                             │              └──────────────┘
                             ▼
                      ┌──────────────┐
                      │  Claude API  │
                      └──────────────┘
```

---

## Run it locally in 60 seconds

**Nothing needs configuring.** With no keys set, the backend uses an in-memory
store and a deterministic plan engine, so the whole app works offline:

```bash
# terminal 1
cd backend  && npm install && npm run dev     # → :4000

# terminal 2
cd frontend && npm install && npm run dev     # → :5173
```

Open <http://localhost:5173>, tap **Continue (local demo)**, and you have a
working account with a real generated plan.

| What you get with no keys | What keys unlock |
|---|---|
| Full UI, both languages, 3D demos | — |
| Deterministic plan generation + safety screening | Claude-authored plans, nuanced screening of free-text meds/injuries |
| In-memory data (wiped on restart) | Real accounts, magic-link sign-in, persistent history |

---

## Safety architecture

This app can tell someone **not to exercise**. That decision is guarded by three
independent layers, and the model is only the first:

| Layer | Where | What it does |
|---|---|---|
| 1. AI screening | `services/intakeAnalyzer.js` | Reads free-text medications and injuries a rule engine can't parse. Uses **structured outputs**, so malformed JSON can never skip the `defer` branch. |
| 2. Hard safety floor | `enforceSafetyFloor()` | Rules the model **cannot override**. It can only ever make the clearance *more* cautious. Recent surgery ⇒ `defer`, full stop. |
| 3. Per-exercise filter | `planEngine.sanitizePlan()` | Strips hallucinated ids, unavailable equipment, and contraindicated movements from whatever plan survives. |

Plus two behaviours enforced in code, never left to the model's judgement:

- **Red-flag interception.** Chest pain, fainting, numbness and similar in the
  coach chat return emergency guidance **before the model is ever called**
  (`routes/coach.js`). Waiting on an LLM to say the right thing about a possibly
  cardiac symptom is not an acceptable design.
- **`defer` means no plan.** Enforced in the analyzer *and* again in the route
  that writes plans. The outcome screen has no bypass.

BMI is computed in code, never by the model, and always shown with
non-clinical framing — never a bare label like "obese".

---

## Deploying (all free tier)

### 1 · Supabase — database + auth

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → paste all of `backend/src/db/schema.sql` → **Run**.
   This creates the tables, row-level security policies, and the trigger that
   makes a profile row on first sign-in.
3. **Authentication → Providers** → enable **Email**.
4. **Project Settings → API** → copy the URL, the `anon` key, and the
   `service_role` key.

> Row-level security is the real security boundary — every policy is scoped to
> `auth.uid()`, so a user physically cannot read another user's rows.

### 2 · Backend — Render

1. Push this repo to GitHub.
2. **New Web Service** → connect the repo → **Root Directory: `backend`**.
3. Build `npm install` · Start `node src/index.js`.
4. Environment variables:

   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | from step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from step 1 |
   | `SUPABASE_ANON_KEY` | from step 1 |
   | `ANTHROPIC_API_KEY` | your key |
   | `FRONTEND_URL` | your Vercel URL (set after step 3) |
   | `NODE_ENV` | `production` |

5. Free instances sleep after inactivity — point [UptimeRobot](https://uptimerobot.com)
   at `/api/health` every 10 minutes to keep it warm.

### 3 · Frontend — Vercel

1. **New Project** → import the repo → **Root Directory: `frontend`** (framework: Vite).
2. Environment variables:

   | Key | Value |
   |---|---|
   | `VITE_API_BASE_URL` | your Render URL |
   | `VITE_SUPABASE_URL` | from step 1 |
   | `VITE_SUPABASE_ANON_KEY` | from step 1 (public — safe to ship) |

3. Deploy, then set `FRONTEND_URL` on Render to the Vercel URL so CORS passes.

> ⚠️ Never put `SUPABASE_SERVICE_ROLE_KEY` in a `VITE_` variable. Anything
> prefixed `VITE_` is compiled into the bundle and readable by every visitor.

---

## Which Claude model, and why

Two models, split by stakes rather than by convenience:

| Path | Model | Reasoning |
|---|---|---|
| Health screening | `claude-opus-4-8` | Most capable. This decision can tell someone not to train — not the place to cost-optimise. |
| Coach chat | `claude-sonnet-5` | Near-Opus quality at a fraction of the cost, right for the high-volume path of a free app. |

Both are overridable via `ANTHROPIC_SCREENING_MODEL` / `ANTHROPIC_COACH_MODEL`.
The screening call uses `output_config.format` (schema-guaranteed JSON) and
adaptive thinking; the coach streams over SSE.

---

## Project layout

```
frontend/
  src/
    i18n/          en.js · am.js (Ge'ez) · index.jsx  ← t(), completeness check
    components/    Demo3D (procedural 3D athlete) · RepSet · TimeSet
                   ExerciseDemo · EmergencyModal · ChatBubble · nav
    pages/         Home · Plans · Intake · MyPlan · Session · Progress · Coach · Library
    lib/           api.js (fetch + SSE) · supabase.js · exercises.js · feedback.js
    hooks/         useAuth · usePlan
  pose-lab.html    dev harness: every 3D animation on one screen

backend/
  src/
    routes/        auth · intake · plan · session · progress · coach
    services/      intakeAnalyzer · planEngine · exercises · anthropic
    middleware/    auth (Supabase JWT / dev token) · rateLimit
    db/            supabase.js · store.js (Supabase ⇄ in-memory) · schema.sql
```

### Notable implementation choices

- **`db/store.js`** presents one interface over Supabase and an in-memory store.
  Routes never branch on which is active, which is what lets the app run with
  zero configuration.
- **Timers derive from timestamps, not counters.** `setInterval` drifts and a
  backgrounded phone stops firing it — a plank timer that counts ticks would be
  wrong by the end of the hold.
- **Sets are buffered and posted once at session end**, not per set. A network
  round trip between every set in a basement gym is not a workable design.
- **Three.js is code-split and lazy-loaded**, so it never enters the initial
  bundle. Initial JS is ~97 KB gzipped; the 3D chunk loads only when a workout
  opens.
- **The 3D athlete is procedural**, not a downloaded GLTF — a few KB of code
  instead of several MB of model, which matters on metered mobile data.

---

## Bilingual guarantees

Amharic is a first-class language, not a translation layer:

- Every user-visible string lives in `i18n/en.js` and `i18n/am.js`, **key for key**.
- There is **no silent English fallback**. A missing Amharic key renders the key
  path — visibly broken beats subtly wrong. `checkTranslations()` logs any gap at
  startup in development.
- The AI returns bilingual `{en, am}` objects for plan labels and clearance notes;
  the system prompt forbids romanisation and forbids copying English into `am`.
- `:lang(am)` swaps in Noto Sans Ethiopic with looser leading — Ge'ez glyphs are
  taller and denser than Latin and get crowded at default line-height.

---

## Accessibility & performance

- Every interactive target is ≥ 44 px; primary buttons are 48 px.
- Colour is never the sole indicator — selected states carry a tick or a bar.
- `prefers-reduced-motion` disables animation *and* makes the 3D athlete render a
  single static pose instead of starting a render loop.
- Focus is always visible; the emergency dialog traps focus and ignores Escape.
- Charts have text captions explaining what they mean.

---

## Verified

Run against the live stack (`backend` + `frontend`, no external services):

| Check | Result |
|---|---|
| Healthy adult → plan generated | ✅ 3 phases, balanced Upper/Lower split |
| Recent surgery → **`defer`, no plan written** | ✅ |
| Joint pain + heart condition → high-impact work excluded | ✅ 0 contraindicated movements |
| …and still gets a usable plan | ✅ 8 low-impact exercises |
| Junk exercise id in session log | ✅ filtered, not stored |
| "chest pain" in coach → emergency, model never called | ✅ EN + AM, with 907 / 911 |
| Full UI walkthrough in Chromium | ✅ zero console errors |

---

## Licence

MIT. Exercise demo GIFs are not bundled — add licensed URLs to `gifUrl` in
`frontend/src/lib/exercises.js` and `ExerciseDemo` will prefer them over the 3D
renderer automatically.
