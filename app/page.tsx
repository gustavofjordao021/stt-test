'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioWaveformPlayer } from '@/components/AudioWaveformPlayer';
import { DEFAULT_DEEPGRAM_CONFIG, type DeepgramConfig } from '@/lib/deepgram-config';

type Locale = 'en' | 'es';

type Prompt = {
  id: string;
  text: string;
};

type Attempt = {
  id: string;
  expected: string;
  transcript: string;
  confidence: number | null;
  createdAt: Date;
  audioUrl?: string;
  model?: string;
};

const EN_PROMPTS: Prompt[] = [
  { id: 'en-1', text: 'My account is A9X-42-Beta!' },
  { id: 'en-2', text: 'Please confirm ZIP 94107 and SSN last four 1234.' },
  { id: 'en-3', text: 'Payment code X7Q4-9Z. Amount $128.50.' },
  { id: 'en-4', text: 'Email: test+dev@example.com.' },
  { id: 'en-5', text: 'Plate number ABC-1234.' },
];

const ES_PROMPTS: Prompt[] = [
  { id: 'es-1', text: 'Mi código es B12-7Z, ¡con signo de exclamación!' },
  { id: 'es-2', text: 'Confirma: código postal 28013 y DNI 1234.' },
  { id: 'es-3', text: 'Importe 128,50 euros.' },
  { id: 'es-4', text: 'Correo: prueba+qa@ejemplo.com.' },
  { id: 'es-5', text: 'Matrícula ABC-1234.' },
];

const EXAMPLE_SET = (process.env.NEXT_PUBLIC_EXAMPLE_SET || 'default').toLowerCase();

const EX_PROMPTS_BY_SET: Record<string, Prompt[]> = {
  default: EN_PROMPTS,
};

function selectPrompts(locale: Locale): Prompt[] {
  if (locale === 'es') return ES_PROMPTS;
  return EX_PROMPTS_BY_SET[EXAMPLE_SET] || EN_PROMPTS;
}

export default function Page() {
  const [name, setName] = useState('');
  const [locale, setLocale] = useState<Locale>('en');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [config, setConfig] = useState<DeepgramConfig>(DEFAULT_DEEPGRAM_CONFIG);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startTimeRef = useRef<number>(0);

  const prompts = selectPrompts(locale);

  const resetRecorder = useCallback(() => {
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
    }
    chunksRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      resetRecorder();
      // Clean up blob URLs on unmount
      attempts.forEach((attempt) => {
        if (attempt.audioUrl) {
          URL.revokeObjectURL(attempt.audioUrl);
        }
      });
    };
  }, [resetRecorder, attempts]);

  const handleStartSession = async () => {
    try {
      setError(null);
      setInfo(null);

      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          locale,
          notes: notes.trim() || undefined,
          config,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || 'Failed to start session');
      }

      setSessionId(json.sessionId);
      setAttempts([]);
      setInfo('Session created. Pick a prompt and start recording.');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
    }
  };

  const handleStartRecording = async () => {
    if (!sessionId) {
      setError('Start a session first.');
      return;
    }

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Your browser does not support audio recording.');
      return;
    }

    if (!selectedPrompt) {
      setError('Select an example prompt before recording.');
      return;
    }

    try {
      setError(null);
      setInfo('Listening… speak the prompt clearly.');
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          setProcessing(true);
          const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
          const audioUrl = URL.createObjectURL(blob);

          const formData = new FormData();
          formData.append('audio', blob, 'clip.webm');
          formData.append('sessionId', sessionId);
          formData.append('expectedPrompt', selectedPrompt.text);
          formData.append('durationMs', String(Date.now() - startTimeRef.current));
          formData.append('locale', locale);

          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });

          const json = await response.json();

          if (!response.ok) {
            throw new Error(json.error || 'Transcription failed');
          }

          const attempt: Attempt = {
            id: crypto.randomUUID(),
            expected: selectedPrompt.text,
            transcript: json.transcript || '',
            confidence: typeof json.confidence === 'number' ? json.confidence : null,
            createdAt: new Date(),
            audioUrl,
            model: config.model,
          };

          setAttempts((prev) => [attempt, ...prev]);
          setInfo('Transcription received.');
        } catch (err) {
          console.error(err);
          setError(err instanceof Error ? err.message : 'Transcription failed');
        } finally {
          setProcessing(false);
          chunksRef.current = [];
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      startTimeRef.current = Date.now();
      setRecording(true);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Microphone access failed');
      resetRecorder();
      setRecording(false);
    }
  };

  const handleStopRecording = () => {
    if (!mediaRecorderRef.current) return;
    setRecording(false);
    setInfo('Uploading audio to Deepgram…');
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-10">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">Deepgram STT Probe</h1>
        <p className="text-sm text-gray-600">
          Record short utterances, send them to Deepgram, and log the results to Supabase. Use this to validate
          transcription quality for alphanumeric content in English and Spanish.
        </p>
      </section>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">1. Start a session</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col text-sm text-gray-600">
            Tester name
            <input
              className="mt-1 rounded border border-gray-200 px-2 py-1 text-sm"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g., Miguel"
            />
          </label>
          <label className="flex flex-col text-sm text-gray-600">
            Locale
            <select
              className="mt-1 rounded border border-gray-200 px-2 py-1 text-sm"
              value={locale}
              onChange={(event) => {
                const value = event.target.value as Locale;
                setLocale(value);
                setSelectedPrompt(null);
              }}
            >
              <option value="en">English (en-US)</option>
              <option value="es">Español (es)</option>
            </select>
          </label>
        </div>
        <label className="block text-sm text-gray-600">
          Notes <span className="text-xs text-gray-400">(optional)</span>
          <textarea
            className="mt-1 h-16 w-full rounded border border-gray-200 px-2 py-1 text-sm"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Hardware, mic position, etc."
          />
        </label>

        {/* Advanced Settings */}
        <div className="border-t border-gray-100 pt-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex w-full items-center justify-between text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            <span>Advanced Deepgram Settings</span>
            <svg
              className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showAdvanced && (
            <div className="mt-4 grid gap-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
              <label className="flex flex-col text-sm text-gray-600">
                Model
                <select
                  className="mt-1 rounded border border-gray-200 bg-white px-2 py-1 text-sm"
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value as DeepgramConfig['model'] })}
                >
                  <option value="base">Base (default)</option>
                  <option value="nova-2">Nova 2 (latest)</option>
                  <option value="nova-2-general">Nova 2 General</option>
                  <option value="enhanced">Enhanced</option>
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={config.smart_format}
                    onChange={(e) => setConfig({ ...config, smart_format: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Smart Format (auto-formatting)
                </label>

                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={config.filler_words}
                    onChange={(e) => setConfig({ ...config, filler_words: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Include Filler Words
                </label>
              </div>

              <label className="flex flex-col text-sm text-gray-600">
                Keywords <span className="text-xs text-gray-400">(comma-separated, boosts accuracy)</span>
                <input
                  className="mt-1 rounded border border-gray-200 bg-white px-2 py-1 text-sm"
                  value={config.keywords || ''}
                  onChange={(e) => setConfig({ ...config, keywords: e.target.value || null })}
                  placeholder="e.g., X7Q4-9Z,payment code,amount"
                />
              </label>
            </div>
          )}
        </div>

        <button
          onClick={handleStartSession}
          disabled={!name.trim() || processing}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {sessionId ? 'Restart Session' : 'Start Session'}
        </button>
        {sessionId && (
          <p className="text-xs text-gray-500">Active session: {sessionId}</p>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">2. Pick a prompt</h2>
        <div className="grid gap-3">
          {prompts.map((prompt) => (
            <button
              key={prompt.id}
              onClick={() => setSelectedPrompt(prompt)}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition ${selectedPrompt?.id === prompt.id
                ? 'border-blue-500 bg-blue-50 text-blue-800'
                : 'border-gray-200 hover:border-gray-300'
                }`}
            >
              {prompt.text}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">3. Record & transcribe</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleStartRecording}
            disabled={recording || !selectedPrompt || processing}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {recording ? 'Recording…' : 'Record'}
          </button>
          <button
            onClick={handleStopRecording}
            disabled={!recording}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Stop & Send
          </button>
          {processing && <span className="text-sm text-gray-500">Uploading and transcribing…</span>}
        </div>

        {selectedPrompt && (
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Expected</p>
            <p className="font-mono text-gray-800">{selectedPrompt.text}</p>
          </div>
        )}
      </section>

      {(info || error) && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${error
            ? 'border-red-200 bg-red-50 text-red-600'
            : 'border-blue-200 bg-blue-50 text-blue-700'
            }`}
        >
          {error || info}
        </div>
      )}

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Recent attempts</h2>
        {attempts.length === 0 ? (
          <p className="text-sm text-gray-500">Record an utterance to see transcriptions here.</p>
        ) : (
          <ul className="space-y-3">
            {attempts.map((attempt) => (
              <li key={attempt.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4 shadow-inner">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    <span>{attempt.createdAt.toLocaleString()}</span>
                    {attempt.model && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {attempt.model}
                      </span>
                    )}
                  </div>
                  {attempt.confidence !== null && (
                    <span>Confidence: {Math.round(attempt.confidence * 100)}%</span>
                  )}
                </div>

                {attempt.audioUrl && (
                  <div className="mt-3">
                    <AudioWaveformPlayer audioUrl={attempt.audioUrl} />
                  </div>
                )}

                <div className="mt-3 grid gap-2 text-sm text-gray-700">
                  <div>
                    <span className="font-semibold text-gray-600">Expected:</span>
                    <p className="font-mono">{attempt.expected}</p>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-600">Transcript:</span>
                    <p className="font-mono">{attempt.transcript || '—'}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
