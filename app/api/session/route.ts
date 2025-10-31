import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { DEFAULT_DEEPGRAM_CONFIG, type DeepgramConfig } from '@/lib/deepgram-config';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const name = body?.name?.trim();
    const locale = body?.locale === 'es' ? 'es' : 'en';
    const notes = body?.notes?.trim() || null;
    const config: DeepgramConfig = body?.config || DEFAULT_DEEPGRAM_CONFIG;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Look up existing tester by name (optional convenience)
    const { data: existingTester, error: testerLookupError } = await supabase
      .from('testers')
      .select('id')
      .eq('name', name)
      .limit(1)
      .maybeSingle();

    if (testerLookupError) {
      return NextResponse.json({ error: testerLookupError.message }, { status: 500 });
    }

    let testerId = existingTester?.id ?? null;

    if (!testerId) {
      const { data: insertedTester, error: testerInsertError } = await supabase
        .from('testers')
        .insert({ name })
        .select('id')
        .single();

      if (testerInsertError) {
        return NextResponse.json({ error: testerInsertError.message }, { status: 500 });
      }

      testerId = insertedTester.id;
    }

    const { data: session, error: sessionError } = await supabase
      .from('stt_sessions')
      .insert({
        tester_id: testerId,
        tester_name: name,
        locale,
        notes,
        provider: config.provider || 'deepgram',
        config,
      })
      .select('id, provider, config')
      .single();

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 500 });
    }

    return NextResponse.json({
      sessionId: session.id,
      provider: session.provider,
      config: session.config
    });
  } catch (error) {
    console.error('[session] unexpected error', error);
    return NextResponse.json({ error: 'unexpected error' }, { status: 500 });
  }
}
