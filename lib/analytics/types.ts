export interface SessionWithAttempts {
    id: string;
    tester_id: string;
    tester_name: string;
    locale: 'en' | 'es';
    provider: 'deepgram' | 'assemblyai';
    notes: string | null;
    config: Record<string, any>;
    created_at: string;
    attempts: AttemptData[];
}

export interface AttemptData {
    id: string;
    session_id: string;
    expected_prompt: string;
    transcript: string;
    provider: 'deepgram' | 'assemblyai';
    confidence: number | null;
    duration_ms: number | null;
    created_at: string;
}

export interface TesterStats {
    name: string;
    totalAttempts: number;
    avgConfidence: number;
    highConfidenceRate: number;
}

export interface ProviderComparison {
    provider: string;
    totalAttempts: number;
    avgConfidence: number;
    highConfidenceRate: number;
    avgDuration: number;
}

export interface PromptDifficulty {
    prompt: string;
    totalAttempts: number;
    avgConfidence: number;
    failureRate: number;
    byProvider: {
        deepgram?: number;
        assemblyai?: number;
    };
}

export interface DailyTrend {
    date: string;
    attempts: number;
    avgConfidence: number;
    deepgramCount: number;
    assemblyaiCount: number;
}

