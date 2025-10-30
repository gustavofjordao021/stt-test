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
  // Phonetically challenging prompts (C/D/E/P/M/N confusion)
  { id: 'en-6', text: 'Reference code C-D-E-3-P-M-N.' },
  { id: 'en-7', text: 'Serial: M8N2-P5D1-C7E4.' },
  { id: 'en-8', text: 'Confirmation B3P-D9M-E2C-N7.' },
  { id: 'en-9', text: 'Model CD-MN-PE dash 2024.' },
  { id: 'en-10', text: 'License NPC-DME-3517.' },
  // Additional challenging patterns
  { id: 'en-11', text: 'VIN: 1C4RJFBG8EC123456.' },
  { id: 'en-12', text: 'Part number: F8B-C2D-M5N-P1E.' },
  { id: 'en-13', text: 'Tracking: 9B2E-4D7C-6M1P.' },
  { id: 'en-14', text: 'Password: Delta3Echo5Mike7.' },
  { id: 'en-15', text: 'Code: C as in Cat, D as in Dog, M as in Mike.' },
];

const ES_PROMPTS: Prompt[] = [
  { id: 'es-1', text: 'Mi código es B12-7Z, ¡con signo de exclamación!' },
  { id: 'es-2', text: 'Confirma: código postal 28013 y DNI 1234.' },
  { id: 'es-3', text: 'Importe 128,50 euros.' },
  { id: 'es-4', text: 'Correo: prueba+qa@ejemplo.com.' },
  { id: 'es-5', text: 'Matrícula ABC-1234.' },
  // Desafíos fonéticos (C/D/E/P/M/N)
  { id: 'es-6', text: 'Código de referencia C-D-E-3-P-M-N.' },
  { id: 'es-7', text: 'Serie: M8N2-P5D1-C7E4.' },
  { id: 'es-8', text: 'Confirmación B3P-D9M-E2C-N7.' },
  { id: 'es-9', text: 'Modelo CD guion MN guion PE guion 2024.' },
  { id: 'es-10', text: 'Matrícula NPC-DME-3517.' },
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
  const [replaceText, setReplaceText] = useState(''); // Internal state for textarea
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
            <div className="mt-4 space-y-6 rounded-lg border border-gray-100 bg-gray-50 p-4">
              {/* Model Selection */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-800">Model Selection</h3>
                <p className="text-xs text-gray-500">Choose the Deepgram AI model for transcription.</p>
                <label className="flex flex-col text-sm text-gray-600">
                  <select
                    className="mt-1 rounded border border-gray-200 bg-white px-2 py-1.5 text-sm"
                    value={config.model}
                    onChange={(e) => setConfig({ ...config, model: e.target.value as DeepgramConfig['model'] })}
                  >
                    <option value="base">Base (default, balanced)</option>
                    <option value="nova-2">Nova 2 (latest, best accuracy)</option>
                    <option value="nova-2-general">Nova 2 General (optimized for mixed content)</option>
                    <option value="enhanced">Enhanced (older, sometimes better for technical terms)</option>
                  </select>
                </label>
              </div>

              {/* Formatting Options */}
              <div className="space-y-3 border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-800">Formatting</h3>
                <p className="text-xs text-gray-500">Control how Deepgram interprets and formats your audio.</p>

                <label className="flex items-start gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={config.smart_format}
                    onChange={(e) => setConfig({ ...config, smart_format: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Smart Format</div>
                    <div className="text-xs text-gray-500">
                      Applies automatic punctuation, capitalization, and number formatting. Turn OFF for literal alphanumeric transcription.
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={config.filler_words}
                    onChange={(e) => setConfig({ ...config, filler_words: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Include Filler Words</div>
                    <div className="text-xs text-gray-500">
                      Keep interpretive words like "um", "uh", "my", "is a". Turn OFF to get cleaner, more literal output.
                    </div>
                  </div>
                </label>
              </div>

              {/* Language & Detection */}
              <div className="space-y-3 border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-800">Language</h3>
                <p className="text-xs text-gray-500">Force a specific language or let Deepgram auto-detect.</p>

                <label className="flex items-start gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={config.detect_language}
                    onChange={(e) => setConfig({ ...config, detect_language: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Auto-Detect Language</div>
                    <div className="text-xs text-gray-500">
                      Let Deepgram automatically detect the language instead of using the locale you selected above. Useful for mixed-language testing.
                    </div>
                  </div>
                </label>
              </div>

              {/* Keywords */}
              <div className="space-y-2 border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-800">Keywords Boost</h3>
                <p className="text-xs text-gray-500">
                  Comma-separated phrases that Deepgram should prioritize. Improves accuracy for specific alphanumeric patterns, account numbers, or technical terms.
                </p>
                <input
                  className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm placeholder:text-gray-400"
                  value={config.keywords || ''}
                  onChange={(e) => setConfig({ ...config, keywords: e.target.value || null })}
                  placeholder="e.g., X7Q4-9Z, payment code, account number"
                />
              </div>

              {/* Privacy & Redaction */}
              <div className="space-y-3 border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-800">Privacy & Redaction</h3>
                <p className="text-xs text-gray-500">
                  Automatically redact sensitive information from transcripts. Useful for compliance testing and to see if redaction affects alphanumeric accuracy.
                </p>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={config.redact.includes('pci')}
                      onChange={(e) => {
                        const newRedact = e.target.checked
                          ? [...config.redact, 'pci']
                          : config.redact.filter(r => r !== 'pci');
                        setConfig({ ...config, redact: newRedact });
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    Redact PCI (credit card numbers)
                  </label>

                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={config.redact.includes('ssn')}
                      onChange={(e) => {
                        const newRedact = e.target.checked
                          ? [...config.redact, 'ssn']
                          : config.redact.filter(r => r !== 'ssn');
                        setConfig({ ...config, redact: newRedact });
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    Redact SSN (social security numbers)
                  </label>

                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={config.redact.includes('numbers')}
                      onChange={(e) => {
                        const newRedact = e.target.checked
                          ? [...config.redact, 'numbers']
                          : config.redact.filter(r => r !== 'numbers');
                        setConfig({ ...config, redact: newRedact });
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    Redact Numbers (all numeric sequences)
                  </label>
                </div>
              </div>

              {/* Segmentation */}
              <div className="space-y-3 border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-800">Segmentation</h3>
                <p className="text-xs text-gray-500">
                  Control how Deepgram splits the transcript into segments.
                </p>

                <label className="flex items-start gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={config.utterances}
                    onChange={(e) => setConfig({ ...config, utterances: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Enable Utterances</div>
                    <div className="text-xs text-gray-500">
                      Split transcript into separate utterances with timestamps based on pauses. Better for analyzing natural speech patterns.
                    </div>
                  </div>
                </label>
              </div>

              {/* Find & Replace */}
              <div className="space-y-3 border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-800">Find & Replace</h3>
                <p className="text-xs text-gray-500">
                  Automatically replace specific words or phrases in the transcript. This is the solution for converting spoken words like "dash" into symbols like "-". Each rule should be on a new line in the format: <code className="bg-gray-100 px-1 rounded">find:replace</code>
                </p>
                <div className="space-y-2">
                  <textarea
                    className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm placeholder:text-gray-400 font-mono"
                    rows={4}
                    value={replaceText}
                    onChange={(e) => {
                      const text = e.target.value;
                      setReplaceText(text);

                      // Parse the text into replace object
                      const lines = text.split('\n');
                      const newReplace: Record<string, string> = {};
                      lines.forEach(line => {
                        if (line.trim()) {
                          const colonIndex = line.indexOf(':');
                          if (colonIndex > 0) {
                            const find = line.substring(0, colonIndex).trim();
                            const replace = line.substring(colonIndex + 1).trim();
                            if (find) {
                              newReplace[find] = replace;
                            }
                          }
                        }
                      });
                      setConfig({ ...config, replace: newReplace });
                    }}
                    placeholder="dash:-&#10;at:@&#10;dollar:$&#10;space: "
                  />
                  <div className="rounded bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    <strong>💡 Pro Tip:</strong> Keywords boost acoustic recognition, but Replace actually transforms the text. Use Replace for "dash" → "-", "at" → "@", etc.
                  </div>
                  <div className="text-xs text-gray-500">
                    Common examples:
                    <ul className="ml-4 mt-1 list-disc space-y-0.5">
                      <li><code className="bg-gray-100 px-1 rounded">dash:-</code> converts "dash" to hyphen</li>
                      <li><code className="bg-gray-100 px-1 rounded">at:@</code> converts "at" to @ symbol</li>
                      <li><code className="bg-gray-100 px-1 rounded">dollar:$</code> converts "dollar" to $ symbol</li>
                      <li><code className="bg-gray-100 px-1 rounded">Dash:-</code> (capitalized) for mid-sentence usage</li>
                    </ul>
                  </div>
                </div>
              </div>
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
