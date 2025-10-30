# Next Prototype Starter

A clean Next.js 15 template for building internal demos and rapid prototypes. It ships with Tailwind CSS, lightweight placeholder components, and Supabase utilities. The first built-in demo is a **Deepgram STT probe** for validating alphanumeric transcription quality.

## What's inside?

- **Next.js 15 + App Router** with Turbopack dev server
- **Tailwind CSS 4** configured for utility-first styling
- **Supabase helpers** under `lib/supabase` for server and client usage
- **Reusable components** (configuration panel, debug pane, chat UI) implemented as lightweight placeholders
- **Deepgram STT probe** (`app/page.tsx`) to record short utterances and log transcripts to Supabase

## Getting started

```bash
npm install
cp env.example .env.local
# fill in Deepgram + Supabase keys
npm run dev
# open http://localhost:3001
```

### Environment variables (`.env.local`)

```env
NODE_ENV=development
DEEPGRAM_API_KEY=dg_your-api-key-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# NEXT_PUBLIC_EXAMPLE_SET=en_basic  # optional prompt set selector
```

Supabase keys are optional if you do not need persistence. The STT probe uses the **service role key** inside API routes to insert sessions/attempts securely.

## Deepgram STT probe

1. Visit `http://localhost:3001`.
2. Enter tester details (name, locale) and start a session.
3. Choose one of the English/Spanish prompts.
4. Record yourself reading the prompt, then stop and send.
5. Review the transcript, confidence score, and stored attempts.

### API routes

- `POST /api/session` – creates a tester (if needed) and an `stt_sessions` row.
- `POST /api/transcribe` – accepts audio, forwards to Deepgram, stores an `stt_attempts` row, and returns the transcript payload.

### Supabase schema

```sql
create table if not exists testers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists stt_sessions (
  id uuid primary key default gen_random_uuid(),
  tester_id uuid references testers(id),
  tester_name text,
  locale text check (locale in ('en','es')) not null,
  notes text,
  created_at timestamptz default now()
);

create table if not exists stt_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references stt_sessions(id) not null,
  expected_prompt text not null,
  transcript text not null,
  confidence numeric,
  raw jsonb,
  duration_ms integer,
  created_at timestamptz default now()
);

create index on stt_attempts(session_id);
```

Export data directly from Supabase for offline CER/WER analysis once your test runs are complete.

## Project structure

```
app/                # Next.js routes (Deepgram probe lives at app/page.tsx)
components/         # Placeholder UI building blocks
lib/                # Supabase utilities and shared helpers
public/             # Static assets
```

## Suggested next steps

1. Duplicate this repo and rename it for your experiment.
2. Wire Supabase tables or APIs to the placeholder components.
3. Introduce additional routes under `app/` for new flows.
4. Share the demo link with your team.

Happy hacking! 🚀
