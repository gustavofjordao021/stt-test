import { supabase } from '@/lib/supabase/client';
import type { SessionWithAttempts, AttemptData } from './types';

export async function fetchAllAnalyticsData(): Promise<{
    sessions: SessionWithAttempts[];
    allAttempts: AttemptData[];
}> {
    if (!supabase) {
        throw new Error('Supabase not configured');
    }

    // Fetch all sessions
    const { data: sessions, error: sessionsError } = await supabase
        .from('stt_sessions')
        .select('*')
        .order('created_at', { ascending: false });

    if (sessionsError) throw sessionsError;

    // Fetch all attempts
    const { data: attempts, error: attemptsError } = await supabase
        .from('stt_attempts')
        .select('*')
        .order('created_at', { ascending: false });

    if (attemptsError) throw attemptsError;

    // Group attempts by session
    const attemptsMap = new Map<string, AttemptData[]>();
    attempts?.forEach(attempt => {
        if (!attemptsMap.has(attempt.session_id)) {
            attemptsMap.set(attempt.session_id, []);
        }
        attemptsMap.get(attempt.session_id)!.push(attempt);
    });

    const sessionsWithAttempts = sessions?.map(session => ({
        ...session,
        attempts: attemptsMap.get(session.id) || [],
    })) || [];

    return {
        sessions: sessionsWithAttempts,
        allAttempts: attempts || [],
    };
}

