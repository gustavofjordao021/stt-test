'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { AudioWaveformPlayer } from '@/components/AudioWaveformPlayer';
import { DEFAULT_DEEPGRAM_CONFIG, DEFAULT_ASSEMBLYAI_CONFIG, type STTConfig, type DeepgramConfig } from '@/lib/deepgram-config';
import { supabase } from '@/lib/supabase/client';

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
  provider?: 'deepgram' | 'assemblyai';
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

const CUSTOM_PROMPT: Prompt = { id: 'custom', text: '' };

export default function Page() {
  const [name, setName] = useState('');
  const [locale, setLocale] = useState<Locale>('en');
  const [provider, setProvider] = useState<'deepgram' | 'assemblyai'>('deepgram');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [config, setConfig] = useState<STTConfig>(DEFAULT_DEEPGRAM_CONFIG);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [replaceText, setReplaceText] = useState(
    Object.entries(DEFAULT_DEEPGRAM_CONFIG.replace || {})
      .map(([k, v]) => `${k}:${v}`)
      .join('\n')
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [customPromptText, setCustomPromptText] = useState('');
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startTimeRef = useRef<number>(0);

  const prompts = selectPrompts(locale);

  // Update config when provider changes
  useEffect(() => {
    if (provider === 'deepgram') {
      setConfig(DEFAULT_DEEPGRAM_CONFIG);
      setReplaceText(
        Object.entries(DEFAULT_DEEPGRAM_CONFIG.replace || {})
          .map(([k, v]) => `${k}:${v}`)
          .join('\n')
      );
    } else {
      setConfig(DEFAULT_ASSEMBLYAI_CONFIG);
      setReplaceText('');
    }
  }, [provider]);

  // Helper function to get signed URL from Supabase Storage
  const getSignedAudioUrl = async (storagePath: string): Promise<string | null> => {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase.storage
        .from('stt-audio-clips')
        .createSignedUrl(storagePath, 3600); // 1 hour expiry

      if (error) {
        console.error('Failed to create signed URL:', error);
        return null;
      }

      return data.signedUrl;
    } catch (err) {
      console.error('Error creating signed URL:', err);
      return null;
    }
  };

  // Switch config defaults when provider changes
  useEffect(() => {
    if (provider === 'deepgram') {
      setConfig(DEFAULT_DEEPGRAM_CONFIG);
      setReplaceText(
        Object.entries(DEFAULT_DEEPGRAM_CONFIG.replace || {})
          .map(([k, v]) => `${k}:${v}`)
          .join('\n')
      );
    } else {
      setConfig(DEFAULT_ASSEMBLYAI_CONFIG);
      setReplaceText(''); // AssemblyAI doesn't have replace
    }
  }, [provider]);

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
      setIsCreatingSession(true);

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
      toast.success('Session created! Pick a prompt and start recording.');
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to start session';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleStartRecording = async () => {
    if (!sessionId) {
      const errorMsg = 'Start a session first.';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      const errorMsg = 'Your browser does not support audio recording.';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    if (!selectedPrompt) {
      const errorMsg = 'Select an example prompt before recording.';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    try {
      setError(null);
      setInfo('Listening… speak the prompt clearly.');
      toast.info('Listening… speak the prompt clearly.');
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
          const tempAudioUrl = URL.createObjectURL(blob);

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

          // Get signed URL from storage if available, otherwise use temp blob URL
          let finalAudioUrl = tempAudioUrl;
          if (json.audio_url) {
            const signedUrl = await getSignedAudioUrl(json.audio_url);
            if (signedUrl) {
              // Clean up the temporary blob URL since we have a permanent one
              URL.revokeObjectURL(tempAudioUrl);
              finalAudioUrl = signedUrl;
            }
          }

          const attempt: Attempt = {
            id: crypto.randomUUID(),
            expected: selectedPrompt.text,
            transcript: json.transcript || '',
            confidence: typeof json.confidence === 'number' ? json.confidence : null,
            createdAt: new Date(),
            audioUrl: finalAudioUrl,
            model: config.model,
            provider: config.provider,
          };

          setAttempts((prev) => [attempt, ...prev]);
          setInfo('Transcription received.');
          toast.success('Transcription received successfully!');

          // Reset custom prompt after successful recording
          if (selectedPrompt.id === 'custom') {
            setCustomPromptText('');
            setSelectedPrompt(null);
          }
        } catch (err) {
          console.error(err);
          const errorMessage = err instanceof Error ? err.message : 'Transcription failed';
          setError(errorMessage);
          toast.error(errorMessage);
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
      const errorMessage = err instanceof Error ? err.message : 'Microphone access failed';
      setError(errorMessage);
      toast.error(errorMessage);
      resetRecorder();
      setRecording(false);
    }
  };

  const handleStopRecording = () => {
    if (!mediaRecorderRef.current) return;
    setRecording(false);
    const uploadMsg = 'Uploading audio and transcribing…';
    setInfo(uploadMsg);
    toast.loading(uploadMsg);
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-10">
      <div className="flex justify-end">
        <Link
          href="/analytics"
          className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
        >
          View Analytics →
        </Link>
      </div>

      <section className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">Deepgram STT Probe</h1>
        <p className="text-sm text-gray-600">
          Record short utterances, send them to Deepgram, and log the results to Supabase. Use this to validate
          transcription quality for alphanumeric content in English and Spanish.
        </p>
      </section>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">1. Start a session</h2>

        {/* STT Provider Selector */}
        <label className="flex flex-col text-sm text-gray-600">
          STT Provider
          <select
            className="mt-1 rounded border border-gray-200 px-2 py-1 text-sm"
            value={provider}
            onChange={(event) => setProvider(event.target.value as 'deepgram' | 'assemblyai')}
            disabled={!!sessionId}
          >
            <option value="deepgram">Deepgram (default)</option>
            <option value="assemblyai">AssemblyAI</option>
          </select>
          <span className="mt-1 text-xs text-gray-500">
            {provider === 'deepgram' ? '⚡ Real-time streaming, replace rules' : '🎯 Async processing, speaker labels'}
          </span>
        </label>

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
              <p className="text-xs text-gray-600 italic">
                Showing <strong>{provider === 'deepgram' ? 'Deepgram' : 'AssemblyAI'}</strong> parameters.
                Pre-populated with recommended settings for alphanumeric testing.
                {provider === 'deepgram' && ' Switch provider above to see AssemblyAI options.'}
                {provider === 'assemblyai' && ' Switch provider above to see Deepgram options.'}
              </p>
              {/* Model Selection */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-800">Model Selection</h3>
                <p className="text-xs text-gray-500">
                  {provider === 'deepgram'
                    ? 'Choose the Deepgram AI model for transcription.'
                    : 'Choose the AssemblyAI model for transcription.'}
                </p>
                <label className="flex flex-col text-sm text-gray-600">
                  <select
                    className="mt-1 rounded border border-gray-200 bg-white px-2 py-1.5 text-sm"
                    value={config.model}
                    onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  >
                    {provider === 'deepgram' ? (
                      <>
                        <option value="base">Base (default, balanced)</option>
                        <option value="nova-2">Nova 2 (latest, best accuracy)</option>
                        <option value="nova-2-general">Nova 2 General (optimized for mixed content)</option>
                        <option value="enhanced">Enhanced (older, sometimes better for technical terms)</option>
                      </>
                    ) : (
                      <>
                        <option value="best">Best (highest accuracy, recommended)</option>
                        <option value="nano">Nano (faster, lightweight)</option>
                      </>
                    )}
                  </select>
                </label>
              </div>

              {/* Deepgram-Specific Settings */}
              {provider === 'deepgram' && (
                <>
                  {/* Formatting Options */}
                  <div className="space-y-3 border-t border-gray-200 pt-4">
                    <h3 className="text-sm font-semibold text-gray-800">Formatting</h3>
                    <p className="text-xs text-gray-500">Control how Deepgram interprets and formats your audio.</p>

                    <label className="flex items-start gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={config.smart_format ?? false}
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
                        checked={config.filler_words ?? false}
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
                        checked={config.detect_language ?? false}
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
                          checked={config.redact?.includes('pci') ?? false}
                          onChange={(e) => {
                            const currentRedact = config.redact || [];
                            const newRedact = e.target.checked
                              ? [...currentRedact, 'pci']
                              : currentRedact.filter(r => r !== 'pci');
                            setConfig({ ...config, redact: newRedact });
                          }}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        Redact PCI (credit card numbers)
                      </label>

                      <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={config.redact?.includes('ssn') ?? false}
                          onChange={(e) => {
                            const currentRedact = config.redact || [];
                            const newRedact = e.target.checked
                              ? [...currentRedact, 'ssn']
                              : currentRedact.filter(r => r !== 'ssn');
                            setConfig({ ...config, redact: newRedact });
                          }}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        Redact SSN (social security numbers)
                      </label>

                      <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={config.redact?.includes('numbers') ?? false}
                          onChange={(e) => {
                            const currentRedact = config.redact || [];
                            const newRedact = e.target.checked
                              ? [...currentRedact, 'numbers']
                              : currentRedact.filter(r => r !== 'numbers');
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
                        checked={config.utterances ?? false}
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
                </>
              )}

              {/* AssemblyAI-Specific Settings */}
              {provider === 'assemblyai' && (
                <>
                  {/* Speaker Labels */}
                  <div className="space-y-3 border-t border-gray-200 pt-4">
                    <h3 className="text-sm font-semibold text-gray-800">Speaker Diarization</h3>
                    <p className="text-xs text-gray-500">
                      ✨ <strong>AssemblyAI only.</strong> Identifies and labels different speakers in multi-speaker audio.
                    </p>

                    <label className="flex items-start gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={config.speaker_labels ?? false}
                        onChange={(e) => setConfig({ ...config, speaker_labels: e.target.checked })}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300"
                      />
                      <div className="flex-1">
                        <div className="font-medium">Enable Speaker Labels</div>
                        <div className="text-xs text-gray-500">
                          Useful for testing conversations with multiple speakers (e.g., customer + agent).
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Entity Detection */}
                  <div className="space-y-3 border-t border-gray-200 pt-4">
                    <h3 className="text-sm font-semibold text-gray-800">Entity Detection</h3>
                    <p className="text-xs text-gray-500">
                      Automatically detect and label entities like names, dates, phone numbers, and other PII.
                    </p>

                    <label className="flex items-start gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={config.entity_detection ?? false}
                        onChange={(e) => setConfig({ ...config, entity_detection: e.target.checked })}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300"
                      />
                      <div className="flex-1">
                        <div className="font-medium">Enable Entity Detection</div>
                        <div className="text-xs text-gray-500">
                          Identifies types of information in the transcript (useful for compliance testing).
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Word Boost */}
                  <div className="space-y-2 border-t border-gray-200 pt-4">
                    <h3 className="text-sm font-semibold text-gray-800">Word Boost</h3>
                    <p className="text-xs text-gray-500">
                      Similar to Deepgram's Keywords. Comma-separated words or phrases that AssemblyAI should prioritize during transcription.
                    </p>
                    <input
                      className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm placeholder:text-gray-400"
                      value={(config.word_boost ?? []).join(', ')}
                      onChange={(e) => {
                        const words = e.target.value
                          .split(',')
                          .map(w => w.trim())
                          .filter(w => w.length > 0);
                        setConfig({ ...config, word_boost: words });
                      }}
                      placeholder="e.g., payment, code, account, dash"
                    />
                  </div>

                  {/* Boost Param */}
                  <div className="space-y-2 border-t border-gray-200 pt-4">
                    <h3 className="text-sm font-semibold text-gray-800">Boost Intensity</h3>
                    <p className="text-xs text-gray-500">
                      Control how strongly boosted words are prioritized.
                    </p>
                    <select
                      className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm"
                      value={config.boost_param ?? 'default'}
                      onChange={(e) => setConfig({ ...config, boost_param: e.target.value as 'low' | 'default' | 'high' })}
                    >
                      <option value="low">Low</option>
                      <option value="default">Default</option>
                      <option value="high">High (recommended for alphanumeric)</option>
                    </select>
                  </div>

                  {/* Note about limitations */}
                  <div className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800 border-t border-gray-200 mt-4">
                    <strong>⚠️ Note:</strong> AssemblyAI doesn't support real-time replace rules like Deepgram.
                    For "dash" → "-" transformations, you'll need to post-process transcripts or use Deepgram.
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleStartSession}
          disabled={!name.trim() || processing || isCreatingSession}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300 flex items-center gap-2"
        >
          {isCreatingSession && <Spinner />}
          {sessionId ? 'Restart Session' : 'Start Session'}
        </button>
        {sessionId && (
          <p className="text-xs text-gray-500">Active session: {sessionId}</p>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">2. Pick a prompt</h2>
        <div className="grid gap-3">
          {/* Custom prompt option */}
          <button
            onClick={() => {
              setSelectedPrompt(CUSTOM_PROMPT);
              setCustomPromptText('');
            }}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition ${selectedPrompt?.id === 'custom'
              ? 'border-blue-500 bg-blue-50 text-blue-800'
              : 'border-gray-200 hover:border-gray-300'
              }`}
          >
            ✏️ Custom - Type your own...
          </button>

          {/* Custom text input (shown when custom is selected) */}
          {selectedPrompt?.id === 'custom' && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom prompt (type exactly what you'll say):
              </label>
              <input
                type="text"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g., License plate: XYZ-789-ABC"
                value={customPromptText}
                onChange={(e) => {
                  setCustomPromptText(e.target.value);
                  setSelectedPrompt({ id: 'custom', text: e.target.value });
                }}
                autoFocus
              />
              <p className="mt-2 text-xs text-gray-600">
                💡 Tip: Include dashes, symbols, and challenging letters for better testing
              </p>
            </div>
          )}

          {/* Pre-defined prompts */}
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
            disabled={
              recording ||
              !selectedPrompt ||
              (selectedPrompt?.id === 'custom' && !customPromptText.trim()) ||
              processing
            }
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-gray-300 flex items-center gap-2"
          >
            {recording && <Spinner />}
            {recording ? 'Recording…' : 'Record'}
          </button>
          <button
            onClick={handleStopRecording}
            disabled={!recording}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-gray-300 flex items-center gap-2"
          >
            {processing && <Spinner />}
            Stop & Send
          </button>
          {processing && <span className="text-sm text-gray-500 flex items-center gap-2"><Spinner className="size-4" />Uploading and transcribing…</span>}
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
                    {attempt.provider && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${attempt.provider === 'deepgram'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-green-100 text-green-700'
                        }`}>
                        {attempt.provider === 'deepgram' ? 'Deepgram' : 'AssemblyAI'}
                      </span>
                    )}
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
