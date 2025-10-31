import type {
    SessionWithAttempts,
    AttemptData,
    ProviderComparison,
    TesterStats,
    PromptDifficulty,
    DailyTrend,
} from './types';

export function calculateProviderComparison(attempts: AttemptData[]): ProviderComparison[] {
    const grouped = attempts.reduce((acc, attempt) => {
        const provider = attempt.provider || 'unknown';
        if (!acc[provider]) {
            acc[provider] = {
                provider,
                totalAttempts: 0,
                totalConfidence: 0,
                highConfidenceCount: 0,
                totalDuration: 0,
            };
        }
        acc[provider].totalAttempts++;
        if (attempt.confidence !== null) {
            acc[provider].totalConfidence += attempt.confidence;
            if (attempt.confidence > 0.9) acc[provider].highConfidenceCount++;
        }
        if (attempt.duration_ms) acc[provider].totalDuration += attempt.duration_ms;
        return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped).map(g => ({
        provider: g.provider,
        totalAttempts: g.totalAttempts,
        avgConfidence: g.totalAttempts > 0 ? g.totalConfidence / g.totalAttempts : 0,
        highConfidenceRate: g.totalAttempts > 0 ? g.highConfidenceCount / g.totalAttempts : 0,
        avgDuration: g.totalAttempts > 0 ? g.totalDuration / g.totalAttempts : 0,
    }));
}

export function calculateTesterStats(sessions: SessionWithAttempts[]): TesterStats[] {
    const grouped = sessions.reduce((acc, session) => {
        const name = session.tester_name;
        if (!acc[name]) {
            acc[name] = {
                name,
                totalAttempts: 0,
                totalConfidence: 0,
                highConfidenceCount: 0,
            };
        }
        session.attempts.forEach(attempt => {
            acc[name].totalAttempts++;
            if (attempt.confidence !== null) {
                acc[name].totalConfidence += attempt.confidence;
                if (attempt.confidence > 0.9) acc[name].highConfidenceCount++;
            }
        });
        return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped).map(t => ({
        name: t.name,
        totalAttempts: t.totalAttempts,
        avgConfidence: t.totalAttempts > 0 ? t.totalConfidence / t.totalAttempts : 0,
        highConfidenceRate: t.totalAttempts > 0 ? t.highConfidenceCount / t.totalAttempts : 0,
    }));
}

export function calculatePromptDifficulty(attempts: AttemptData[]): PromptDifficulty[] {
    const grouped = attempts.reduce((acc, attempt) => {
        const prompt = attempt.expected_prompt;
        if (!acc[prompt]) {
            acc[prompt] = {
                prompt,
                totalAttempts: 0,
                totalConfidence: 0,
                failureCount: 0,
                byProvider: {},
            };
        }
        acc[prompt].totalAttempts++;
        if (attempt.confidence !== null) {
            acc[prompt].totalConfidence += attempt.confidence;
            if (attempt.confidence < 0.8) acc[prompt].failureCount++;

            const provider = attempt.provider || 'unknown';
            if (!acc[prompt].byProvider[provider]) {
                acc[prompt].byProvider[provider] = { total: 0, sum: 0 };
            }
            acc[prompt].byProvider[provider].total++;
            acc[prompt].byProvider[provider].sum += attempt.confidence;
        }
        return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped).map(p => ({
        prompt: p.prompt.substring(0, 40) + (p.prompt.length > 40 ? '...' : ''),
        totalAttempts: p.totalAttempts,
        avgConfidence: p.totalAttempts > 0 ? p.totalConfidence / p.totalAttempts : 0,
        failureRate: p.totalAttempts > 0 ? p.failureCount / p.totalAttempts : 0,
        byProvider: Object.keys(p.byProvider).reduce((acc, key) => {
            acc[key] = p.byProvider[key].sum / p.byProvider[key].total;
            return acc;
        }, {} as any),
    }));
}

export function calculateDailyTrends(attempts: AttemptData[]): DailyTrend[] {
    const grouped = attempts.reduce((acc, attempt) => {
        const date = new Date(attempt.created_at).toISOString().split('T')[0];
        if (!acc[date]) {
            acc[date] = {
                date,
                attempts: 0,
                totalConfidence: 0,
                deepgramCount: 0,
                assemblyaiCount: 0,
            };
        }
        acc[date].attempts++;
        if (attempt.confidence !== null) {
            acc[date].totalConfidence += attempt.confidence;
        }
        if (attempt.provider === 'deepgram') acc[date].deepgramCount++;
        if (attempt.provider === 'assemblyai') acc[date].assemblyaiCount++;
        return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped)
        .map(d => ({
            date: d.date,
            attempts: d.attempts,
            avgConfidence: d.attempts > 0 ? d.totalConfidence / d.attempts : 0,
            deepgramCount: d.deepgramCount,
            assemblyaiCount: d.assemblyaiCount,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

