import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { buildDeepgramUrl, DEFAULT_DEEPGRAM_CONFIG, type DeepgramConfig } from '@/lib/deepgram-config';

export const runtime = 'nodejs';

const DEEPGRAM_URL = 'https://api.deepgram.com/v1/listen';

function getLanguageParam(locale: string | null) {
  if (locale === 'es') return 'es';
  return 'en-US';
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('audio');
    const sessionId = (form.get('sessionId') as string) ?? '';
    const expectedPrompt = (form.get('expectedPrompt') as string) ?? '';
    const durationMsValue = form.get('durationMs');
    const locale = (form.get('locale') as string) ?? 'en';

    if (!(file instanceof File) || !sessionId || !expectedPrompt) {
      return NextResponse.json(
        { error: 'audio, sessionId, and expectedPrompt are required' },
        { status: 400 }
      );
    }

    if (!process.env.DEEPGRAM_API_KEY) {
      return NextResponse.json({ error: 'Deepgram API key not configured' }, { status: 500 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch session config
    const { data: sessionData, error: sessionError } = await supabase
      .from('stt_sessions')
      .select('config')
      .eq('id', sessionId)
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json(
        { error: 'Session not found or error fetching config' },
        { status: 404 }
      );
    }

    const config: DeepgramConfig = sessionData.config || DEFAULT_DEEPGRAM_CONFIG;
    const audioBuffer = Buffer.from(await file.arrayBuffer());
    const language = getLanguageParam(locale);
    const dgUrl = buildDeepgramUrl(DEEPGRAM_URL, config, language);

    const dgResponse = await fetch(dgUrl, {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': file.type || 'audio/webm',
        Accept: 'application/json',
      },
      body: audioBuffer,
    });

    if (!dgResponse.ok) {
      const details = await dgResponse.text().catch(() => '');
      return NextResponse.json(
        {
          error: 'Deepgram transcription failed',
          details,
          status: dgResponse.status,
        },
        { status: 502 }
      );
    }

    const deepgramJson = await dgResponse.json();
    const firstAlternative =
      deepgramJson?.results?.channels?.[0]?.alternatives?.[0] ?? null;

    const transcript: string = firstAlternative?.transcript ?? '';
    const confidence: number | null =
      typeof firstAlternative?.confidence === 'number'
        ? firstAlternative.confidence
        : null;

    const durationMs = durationMsValue ? Number(durationMsValue) : null;

    const { error: insertError } = await supabase.from('stt_attempts').insert({
      session_id: sessionId,
      expected_prompt: expectedPrompt,
      transcript,
      confidence,
      raw: deepgramJson,
      duration_ms: Number.isFinite(durationMs) ? Math.round(durationMs as number) : null,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ transcript, confidence, raw: deepgramJson });
  } catch (error) {
    console.error('[transcribe] unexpected error', error);
    return NextResponse.json({ error: 'unexpected error' }, { status: 500 });
  }
}
