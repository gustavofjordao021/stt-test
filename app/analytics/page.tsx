'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { fetchAllAnalyticsData } from '@/lib/analytics/queries';
import {
    calculateProviderComparison,
    calculateTesterStats,
    calculatePromptDifficulty,
    calculateDailyTrends,
} from '@/lib/analytics/calculations';
import type {
    ProviderComparison,
    TesterStats,
    PromptDifficulty,
    DailyTrend,
} from '@/lib/analytics/types';

const COLORS = {
    deepgram: '#9333ea',
    assemblyai: '#10b981',
    primary: '#3b82f6',
    secondary: '#8b5cf6',
};

export default function AnalyticsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [providerData, setProviderData] = useState<ProviderComparison[]>([]);
    const [testerData, setTesterData] = useState<TesterStats[]>([]);
    const [promptData, setPromptData] = useState<PromptDifficulty[]>([]);
    const [trendData, setTrendData] = useState<DailyTrend[]>([]);
    const [totalStats, setTotalStats] = useState({
        totalSessions: 0,
        totalAttempts: 0,
        avgConfidence: 0,
    });

    useEffect(() => {
        async function loadData() {
            try {
                const { sessions, allAttempts } = await fetchAllAnalyticsData();

                // Calculate all metrics
                setProviderData(calculateProviderComparison(allAttempts));
                setTesterData(calculateTesterStats(sessions));
                setPromptData(calculatePromptDifficulty(allAttempts).slice(0, 10)); // Top 10
                setTrendData(calculateDailyTrends(allAttempts));

                // Overall stats
                const avgConf = allAttempts.reduce((sum, a) => sum + (a.confidence || 0), 0) / allAttempts.length;
                setTotalStats({
                    totalSessions: sessions.length,
                    totalAttempts: allAttempts.length,
                    avgConfidence: avgConf || 0,
                });

                setLoading(false);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
                setError(errorMessage);
                toast.error(`Failed to load analytics: ${errorMessage}`);
                setLoading(false);
            }
        }

        loadData();
    }, []);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-lg text-gray-600">Loading analytics...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white p-8">
                <div className="max-w-md rounded-xl border border-red-200 bg-white p-8 shadow-sm">
                    <h2 className="mb-4 text-xl font-semibold text-red-600">Configuration Error</h2>
                    <p className="mb-4 text-sm text-gray-700">{error}</p>
                    <div className="rounded-lg bg-gray-50 p-4">
                        <p className="mb-2 text-sm font-semibold text-gray-900">To fix this:</p>
                        <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
                            <li>Ensure Supabase is configured in <code className="rounded bg-gray-200 px-1">.env.local</code></li>
                            <li>Add these variables:
                                <pre className="mt-2 overflow-x-auto rounded bg-gray-900 p-2 text-xs text-gray-100">
                                    {`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`}
                                </pre>
                            </li>
                            <li>Restart the dev server</li>
                            <li>Record some test attempts on the main page</li>
                            <li>Return here to see your analytics</li>
                        </ol>
                    </div>
                    <div className="mt-6">
                        <Link
                            href="/"
                            className="inline-block rounded-lg bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600"
                        >
                            ← Back to Testing
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-8">
            {/* Header */}
            <div className="mx-auto max-w-7xl">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
                        <p className="mt-2 text-gray-600">
                            STT Testing Performance Insights
                        </p>
                    </div>
                    <Link
                        href="/"
                        className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
                    >
                        Back to Testing
                    </Link>
                </div>

                {/* Summary Cards */}
                <div className="mb-8 grid gap-6 sm:grid-cols-3">
                    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="text-sm text-gray-600">Total Sessions</div>
                        <div className="mt-2 text-3xl font-bold text-gray-900">
                            {totalStats.totalSessions}
                        </div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="text-sm text-gray-600">Total Attempts</div>
                        <div className="mt-2 text-3xl font-bold text-gray-900">
                            {totalStats.totalAttempts}
                        </div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="text-sm text-gray-600">Avg Confidence</div>
                        <div className="mt-2 text-3xl font-bold text-gray-900">
                            {(totalStats.avgConfidence * 100).toFixed(1)}%
                        </div>
                    </div>
                </div>

                {/* Charts Grid */}
                <div className="space-y-8">
                    {/* Provider Comparison */}
                    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <h2 className="mb-4 text-xl font-semibold text-gray-900">
                            Provider Performance Comparison
                        </h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={providerData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="provider" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="avgConfidence" fill={COLORS.primary} name="Avg Confidence" />
                                <Bar dataKey="highConfidenceRate" fill={COLORS.secondary} name="High Confidence Rate" />
                            </BarChart>
                        </ResponsiveContainer>
                    </section>

                    {/* Daily Trends */}
                    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <h2 className="mb-4 text-xl font-semibold text-gray-900">
                            Daily Testing Activity & Confidence Trends
                        </h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis yAxisId="left" />
                                <YAxis yAxisId="right" orientation="right" />
                                <Tooltip />
                                <Legend />
                                <Line
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey="avgConfidence"
                                    stroke={COLORS.primary}
                                    name="Avg Confidence"
                                />
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="attempts"
                                    stroke={COLORS.secondary}
                                    name="Attempts"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </section>

                    {/* Prompt Difficulty */}
                    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <h2 className="mb-4 text-xl font-semibold text-gray-900">
                            Most Challenging Prompts (Top 10)
                        </h2>
                        <ResponsiveContainer width="100%" height={400}>
                            <BarChart data={promptData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" domain={[0, 1]} />
                                <YAxis dataKey="prompt" type="category" width={200} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="avgConfidence" fill={COLORS.primary} name="Avg Confidence" />
                            </BarChart>
                        </ResponsiveContainer>
                    </section>

                    {/* Tester Performance */}
                    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <h2 className="mb-4 text-xl font-semibold text-gray-900">
                            Tester Performance Comparison
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead>
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                            Tester
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                            Total Attempts
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                            Avg Confidence
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                            High Confidence Rate
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {testerData.map((tester, idx) => (
                                        <tr key={idx}>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                                                {tester.name}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                                                {tester.totalAttempts}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                                                {(tester.avgConfidence * 100).toFixed(1)}%
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                                                {(tester.highConfidenceRate * 100).toFixed(1)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Provider Distribution */}
                    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <h2 className="mb-4 text-xl font-semibold text-gray-900">
                            Provider Usage Distribution
                        </h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={providerData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={(entry) => `${entry.provider}: ${entry.totalAttempts}`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="totalAttempts"
                                >
                                    {providerData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.provider === 'deepgram' ? COLORS.deepgram : COLORS.assemblyai}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </section>
                </div>
            </div>
        </main>
    );
}

