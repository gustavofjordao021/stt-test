# Multi-Provider STT Testing Framework

A specialized testing tool for evaluating Speech-to-Text accuracy on alphanumeric patterns, particularly for customer service and IVR use cases. Compare **Deepgram** and **AssemblyAI** side-by-side to systematically assess transcription quality across phonetically challenging content (account numbers, payment codes, reference IDs) in English and US Spanish dialects.

## Business Context

### The Problem
Traditional STT engines struggle with alphanumeric patterns that are critical in customer service:
- Account numbers: "X7Q4-9Z" often becomes "X seven Q four dash nine Z"
- Payment codes with symbols: "$128.50" transcribes inconsistently
- Phonetically similar letters: C/D/E/P/M/N frequently confused
- Spanish dialects: "dash" vs "guion" vs "raya" (regional variations)

These errors create friction in automated IVR systems, forcing customers to repeat information or fall back to human agents.

### The Solution
This framework provides:
1. **Multi-provider A/B testing**: Compare Deepgram and AssemblyAI on identical prompts
2. **Reproducible test cases**: 15+ pre-defined prompts targeting known failure modes
3. **Custom prompt testing**: On-the-fly testing of real-world edge cases
4. **Configuration experimentation**: Expose provider-specific parameters (models, replace rules, speaker labels) to find optimal settings
5. **Structured data collection**: Every test stored in Supabase for analysis
6. **Session-based tracking**: Compare configurations and providers across test runs

## Key Capabilities

### 1. Pre-Configured Testing
- **15 pre-defined prompts** covering alphanumeric patterns, phonetically challenging letters, and financial data
- **Bilingual support**: English and US Spanish (with regional dialect variations)
- **One-click recording**: Select prompt → Record → Compare expected vs actual

### 2. Custom Prompt Input
- Test real-world patterns discovered in production
- No code changes required
- Immediate validation of edge cases

### 3. Multi-Provider Support
Choose between **Deepgram** (real-time, replace rules) or **AssemblyAI** (async, speaker labels):
- **Deepgram**: Nova-2, Base, Enhanced models; real-time replace rules; keyword boost
- **AssemblyAI**: Best/Nano models; speaker diarization; entity detection; word boost
- **Provider badges**: Easily see which STT provider was used for each attempt
- **Unified interface**: Same workflow regardless of provider
- **Data comparison**: Query Supabase by provider to analyze performance

### 4. Advanced Configuration Control
Pre-populated smart defaults optimized for alphanumeric accuracy:
- **Model selection**: Provider-specific models (Nova-2, Best, etc.)
- **Smart Format OFF** (Deepgram): Prevents interpretation errors
- **Filler Words OFF** (Deepgram): Removes "um", "uh" for cleaner output
- **Replace rules** (Deepgram only): Automatic symbol mapping (dash→-, at→@, dollar→$)
- **Keywords/Word boost**: Prioritize domain-specific terms
- **Spanish variants**: Handles guion/raya/menos (regional dash variations)

### 5. Audio Replay
- Verify what was actually recorded
- Identify user pronunciation vs transcription issues
- Useful for training and quality assurance

## Getting started

```bash
npm install
cp env.example .env.local
# fill in provider API keys + Supabase credentials
npm run dev
# open http://localhost:3000
```

### Environment variables (`.env.local`)

```env
NODE_ENV=development

# STT Provider API Keys
DEEPGRAM_API_KEY=dg_your-api-key-here
ASSEMBLYAI_API_KEY=your-assemblyai-api-key-here

# Supabase (for data persistence)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional
# NEXT_PUBLIC_EXAMPLE_SET=en_basic  # prompt set selector
```

**Note**: You only need API keys for the providers you plan to test. Supabase keys are optional if you don't need persistence. The framework uses the **service role key** inside API routes to insert sessions/attempts securely.

## How It Works

### User Flow
1. **Choose provider**: Select Deepgram or AssemblyAI (each has unique features)
2. **Start a session**: Enter tester name, select language (EN/ES), optionally configure provider parameters
3. **Pick a prompt**: Choose from 15 pre-defined patterns or create a custom one
4. **Record**: Speak the prompt clearly into your microphone
5. **Compare**: View expected text vs actual transcript, with confidence score and provider badge
6. **Iterate**: Switch providers, adjust configuration, try different prompts, replay audio

Each test attempt is immediately visible in the UI (with provider badge) and stored in Supabase for later analysis.

### Data Architecture

The framework uses three Supabase tables to organize test data:

#### `testers`
Tracks who is performing tests. Auto-created on first session.
```sql
- id: uuid (primary key)
- name: text (tester identifier)
- created_at: timestamp
```

**Use case**: Compare transcription quality across different speakers (accents, pronunciation styles, audio quality).

#### `stt_sessions`
Groups related test attempts under a single provider and configuration.
```sql
- id: uuid (primary key)
- tester_id: uuid (foreign key to testers)
- tester_name: text (denormalized for easier queries)
- locale: 'en' | 'es'
- provider: 'deepgram' | 'assemblyai'
- notes: text (optional session description)
- config: jsonb (provider-specific parameters)
- created_at: timestamp
```

**Use case**: 
- Compare providers (Deepgram vs AssemblyAI on same prompts)
- A/B test configurations (Nova-2 vs Base model, Smart Format ON vs OFF)
- Track which parameters were used for each test run
- Annotate sessions with context (e.g., "Testing with background noise")

#### `stt_attempts`
Individual recordings and their transcription results.
```sql
- id: uuid (primary key)
- session_id: uuid (foreign key to stt_sessions)
- expected_prompt: text (what should be said)
- transcript: text (what the provider heard)
- provider: text ('deepgram' or 'assemblyai')
- confidence: numeric (0-1, provider's confidence score)
- raw: jsonb (full API response from provider)
- duration_ms: integer (recording length)
- created_at: timestamp
```

**Use case**:
- Compare provider performance on identical prompts
- Calculate Character Error Rate (CER) or Word Error Rate (WER) per provider
- Identify patterns in failures (e.g., "dash" always transcribed as "Dash")
- Measure confidence scores for different prompt types

### API Routes

**`POST /api/session`**
- Creates/looks up tester by name
- Creates new session with Deepgram configuration
- Returns `sessionId` and stored config
- **Why it matters**: Ensures all attempts in a session use the same parameters

**`POST /api/transcribe`**
- Accepts audio blob, session ID, expected prompt
- Fetches session config from Supabase
- Dynamically builds Deepgram API URL with session's parameters
- Forwards audio to Deepgram
- Stores attempt with transcript, confidence, raw response
- **Why it matters**: Reproducible results—you can re-run the exact same config later

## Assessing Results

### In the UI (Quick Iteration)
- **Visual comparison**: Expected vs Transcript side-by-side
- **Confidence scores**: 0-1 scale, >0.9 = high confidence
- **Audio replay**: Hear exactly what was recorded
- **Model badges**: See which model was used for each attempt

### In Supabase (Deep Analysis)

#### 1. Export for Offline Analysis
```sql
-- Export all attempts with session context
SELECT 
  a.created_at,
  t.name as tester,
  s.locale,
  s.config->>'model' as model,
  s.config->>'smart_format' as smart_format,
  a.expected_prompt,
  a.transcript,
  a.confidence,
  a.duration_ms
FROM stt_attempts a
JOIN stt_sessions s ON a.session_id = s.id
JOIN testers t ON s.tester_id = t.id
ORDER BY a.created_at DESC;
```

#### 2. Calculate Accuracy Metrics
- **Character Error Rate (CER)**: Use Python/R with libraries like `jiwer`
- **Word Error Rate (WER)**: Standard metric for STT quality
- **Symbol preservation**: Count how many "$", "@", "-" were correctly transcribed

#### 3. Identify Failure Patterns
```sql
-- Find prompts with lowest confidence
SELECT 
  expected_prompt,
  AVG(confidence) as avg_confidence,
  COUNT(*) as attempts
FROM stt_attempts
GROUP BY expected_prompt
HAVING AVG(confidence) < 0.8
ORDER BY avg_confidence ASC;
```

#### 4. Compare Providers
```sql
-- Compare Deepgram vs AssemblyAI performance
SELECT 
  provider,
  AVG(confidence) as avg_confidence,
  COUNT(*) as total_attempts,
  COUNT(CASE WHEN confidence > 0.9 THEN 1 END) as high_confidence_count,
  AVG(duration_ms) as avg_duration_ms
FROM stt_attempts
GROUP BY provider;
```

#### 5. Provider Performance by Prompt
```sql
-- See which provider handles each prompt better
SELECT 
  expected_prompt,
  provider,
  AVG(confidence) as avg_confidence,
  COUNT(*) as attempts
FROM stt_attempts
GROUP BY expected_prompt, provider
ORDER BY expected_prompt, provider;
```

#### 6. A/B Test Configurations
```sql
-- Compare Nova-2 vs Base model (Deepgram)
SELECT 
  s.config->>'model' as model,
  AVG(a.confidence) as avg_confidence,
  COUNT(*) as total_attempts,
  COUNT(CASE WHEN a.confidence > 0.9 THEN 1 END) as high_confidence_count
FROM stt_attempts a
JOIN stt_sessions s ON a.session_id = s.id
WHERE a.provider = 'deepgram'
GROUP BY s.config->>'model';
```

#### 7. Track Improvement Over Time
```sql
-- See if later sessions perform better (after tuning config)
SELECT 
  DATE(a.created_at) as test_date,
  AVG(a.confidence) as avg_confidence,
  COUNT(*) as attempts
FROM stt_attempts a
GROUP BY DATE(a.created_at)
ORDER BY test_date;
```

## Provider Comparison Guide

### When to Use Deepgram
✅ **Best for**:
- Real-time transcription needs (streaming support)
- Alphanumeric patterns requiring replace rules (dash→-, at→@)
- Cost-sensitive applications (typically cheaper per minute)
- Low-latency requirements

⚠️ **Limitations**:
- No built-in speaker diarization
- No entity detection
- Replace rules are Deepgram-specific (not portable)

### When to Use AssemblyAI
✅ **Best for**:
- Multi-speaker conversations (speaker labels)
- PII detection and redaction (entity detection)
- Longer-form content (async processing handles large files)
- Detailed entity extraction needs

⚠️ **Limitations**:
- Async-only (no real-time streaming)
- Longer processing time (polling required)
- No built-in replace rules (requires post-processing)
- Typically more expensive

### Typical A/B Testing Workflow
1. **Day 1**: Create Deepgram session, test all 15 prompts with default config
2. **Day 2**: Create AssemblyAI session, test same 15 prompts with default config
3. **Day 3**: Compare results in Supabase (SQL queries above)
4. **Day 4**: Tune winner's config (adjust model, boost params, replace rules)
5. **Day 5**: Retest with optimized config
6. **Day 6**: Make final decision based on accuracy + cost + latency trade-offs

## Success Metrics

### Qualitative Goals
- ✅ "Dash" correctly transcribes as "-" (not "Dash" or "dash")
- ✅ Alphanumeric codes maintain structure (X7Q4-9Z stays intact)
- ✅ Spanish dialect variations handled (guion/raya/menos all map to "-")
- ✅ Confidence scores consistently >0.9 for clean recordings

### Quantitative Goals
- **CER < 5%** for alphanumeric prompts
- **WER < 3%** for financial amounts
- **>95% confidence** on phonetically challenging patterns
- **Zero hallucinations** (no words added that weren't spoken)

### Business Impact
- Reduce IVR escalations by improving first-pass accuracy
- Enable fully automated account lookup flows
- Support multilingual customer base with consistent quality
- Reduce development time by identifying optimal Deepgram config before production

## Project structure

```
app/                # Next.js routes (Deepgram probe lives at app/page.tsx)
components/         # Placeholder UI building blocks
lib/                # Supabase utilities and shared helpers
public/             # Static assets
```

## Typical Testing Workflow

### Phase 1: Baseline (Day 1)
1. Run 20-30 attempts with default config (Nova-2, smart format OFF, all replace rules)
2. Test across both EN and ES prompts
3. Identify patterns: Which prompts have lowest confidence? Which fail consistently?
4. Export data to calculate baseline CER/WER

### Phase 2: Configuration Tuning (Day 2-3)
1. Create new session with modified config (e.g., try Base model)
2. Re-test the same prompts
3. Compare confidence scores and transcription accuracy
4. Iterate: adjust keywords, replace rules, try different models
5. Document which configs perform best for which prompt types

### Phase 3: Edge Case Discovery (Day 4-5)
1. Use custom prompt feature to test real-world patterns from production logs
2. Test with background noise, different microphones, accents
3. Identify remaining failure modes
4. Add new replace rules or keywords as needed

### Phase 4: Validation (Day 6-7)
1. Final test run with optimized config
2. 50+ attempts across all prompt types
3. Export data, calculate final CER/WER
4. Document recommended Deepgram configuration for production

## Key Insights from Data

### What to Look For

**High confidence but wrong transcript** = Deepgram is confident but systematically misinterpreting
- Solution: Adjust replace rules or keywords

**Low confidence and wrong transcript** = Acoustic recognition is struggling
- Solution: Try different model, improve audio quality, or use phonetic alphabet

**Consistent failures on specific letters** (C/D/E/P/M/N)
- Solution: Add those letters to keywords list to boost recognition

**Regional Spanish variations** = "guion" vs "raya" for dash
- Solution: Already handled in default config, but verify in data

### Red Flags
- Confidence <0.7 consistently = poor audio quality or configuration issue
- Hallucinations (words not in prompt) = model might be overcompensating
- Empty transcripts = audio not reaching Deepgram (check API keys, network)

## Advanced Use Cases

### Multi-Speaker Testing
Create multiple testers to compare:
- Native vs non-native speakers
- Different regional accents
- Voice quality (phone vs headset vs laptop mic)

```sql
-- Compare testers
SELECT 
  t.name,
  AVG(a.confidence) as avg_confidence,
  COUNT(*) as attempts
FROM stt_attempts a
JOIN stt_sessions s ON a.session_id = s.id
JOIN testers t ON s.tester_id = t.id
GROUP BY t.name
ORDER BY avg_confidence DESC;
```

### Prompt Difficulty Ranking
Identify which prompts are hardest to transcribe:

```sql
-- Rank prompts by difficulty
SELECT 
  expected_prompt,
  AVG(confidence) as avg_confidence,
  STDDEV(confidence) as confidence_variance,
  COUNT(*) as attempts
FROM stt_attempts
GROUP BY expected_prompt
ORDER BY avg_confidence ASC;
```

### Configuration Impact Analysis
Measure the exact impact of each parameter:

```sql
-- Compare smart_format ON vs OFF
SELECT 
  s.config->>'smart_format' as smart_format_setting,
  AVG(a.confidence) as avg_confidence,
  COUNT(*) as attempts
FROM stt_attempts a
JOIN stt_sessions s ON a.session_id = s.id
WHERE a.expected_prompt LIKE '%dash%'
GROUP BY s.config->>'smart_format';
```

## Troubleshooting

### Low confidence scores across the board
- Check audio input device (system preferences → microphone)
- Verify Deepgram API key is valid
- Test in quiet environment
- Ensure speaking clearly and at normal pace

### Transcripts are empty
- Check browser console for errors
- Verify `/api/transcribe` is receiving audio
- Check Supabase service role key
- Verify Deepgram API quota

### Replace rules not working
- Verify rules are in `find:replace` format (one per line)
- Check capitalization (both "dash" and "Dash" needed)
- Test with simple pattern first (e.g., just "dash:-")
- Check Deepgram API URL in network tab

### Sessions not saving to Supabase
- Verify Supabase URL and keys in `.env.local`
- Check Supabase project is not paused
- Verify RLS policies are not blocking inserts
- Check service role key (not anon key) is being used

## Next Steps

### For Production Integration
Once you've identified optimal configuration:
1. Document the winning config (model, parameters, replace rules)
2. Calculate final accuracy metrics (CER, WER, confidence)
3. Export test data as evidence for stakeholders
4. Implement config in production IVR system
5. Monitor real-world performance and compare to test results

### For Continued Testing
- Add more prompts based on production patterns
- Test with additional languages (expand beyond EN/ES)
- Integrate with CI/CD for regression testing
- Build dashboards on top of Supabase data

Happy testing! 🚀
