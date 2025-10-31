import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { DEFAULT_DEEPGRAM_CONFIG, type STTConfig } from '@/lib/deepgram-config';
import { getSTTProvider } from '@/lib/stt-provider';

export const runtime = 'nodejs';

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

    const supabase = getSupabaseAdmin();

    // Fetch session to get provider and config
    const { data: sessionData, error: sessionError } = await supabase
      .from('stt_sessions')
      .select('provider, config')
      .eq('id', sessionId)
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json(
        { error: 'Session not found or error fetching config' },
        { status: 404 }
      );
    }

    const provider = sessionData.provider || 'deepgram';
    const config: STTConfig = sessionData.config || DEFAULT_DEEPGRAM_CONFIG;

    // Validate API keys
    if (provider === 'deepgram' && !process.env.DEEPGRAM_API_KEY) {
      return NextResponse.json({ error: 'Deepgram API key not configured' }, { status: 500 });
    }
    if (provider === 'assemblyai' && !process.env.ASSEMBLYAI_API_KEY) {
      return NextResponse.json({ error: 'AssemblyAI API key not configured' }, { status: 500 });
    }

    // Get appropriate provider
    const sttProvider = getSTTProvider(provider);

    // Convert file to blob
    const audioBlob = new Blob([await file.arrayBuffer()], { type: file.type || 'audio/webm' });
    const language = getLanguageParam(locale);

    // Upload audio to Supabase Storage
    let audioUrl: string | null = null;
    try {
      const audioBuffer = await file.arrayBuffer();
      const fileExtension = file.name.split('.').pop() || 'webm';
      const fileName = `${sessionId}/${crypto.randomUUID()}.${fileExtension}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('stt-audio-clips')
        .upload(fileName, audioBuffer, {
          contentType: file.type || 'audio/webm',
          upsert: false,
        });

      if (uploadError) {
        console.error('[transcribe] Failed to upload audio to storage:', uploadError);
        // Don't block transcription if storage fails
      } else {
        audioUrl = uploadData.path;
      }
    } catch (storageError) {
      console.error('[transcribe] Storage upload error:', storageError);
      // Continue with transcription even if storage fails
    }

    // Transcribe using the selected provider
    const result = await sttProvider.transcribe(audioBlob, config, language);

    const durationMs = durationMsValue ? Number(durationMsValue) : null;

    // Store attempt with provider and audio URL
    const { error: insertError } = await supabase.from('stt_attempts').insert({
      session_id: sessionId,
      expected_prompt: expectedPrompt,
      transcript: result.transcript,
      confidence: result.confidence,
      provider,
      raw: result.raw,
      duration_ms: Number.isFinite(durationMs) ? Math.round(durationMs as number) : null,
      audio_url: audioUrl,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      transcript: result.transcript,
      confidence: result.confidence,
      raw: result.raw,
      audio_url: audioUrl,
    });
  } catch (error) {
    console.error('[transcribe] unexpected error', error);
    return NextResponse.json({ error: 'unexpected error' }, { status: 500 });
  }
}
