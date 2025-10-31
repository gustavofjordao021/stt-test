// Unified STT Config supporting multiple providers
export interface STTConfig {
  // Required
  provider: 'deepgram' | 'assemblyai';

  // Common (both providers)
  model: string; // provider-specific values
  punctuate: boolean;
  numerals: boolean; // Deepgram: numerals, AssemblyAI: format_text
  profanity_filter: boolean;
  language: string;

  // Deepgram-specific (ignored if provider=assemblyai)
  smart_format?: boolean;
  filler_words?: boolean;
  replace?: Record<string, string>;
  keywords?: string | null;
  detect_language?: boolean;
  redact?: string[];
  utterances?: boolean;

  // AssemblyAI-specific (ignored if provider=deepgram)
  speaker_labels?: boolean;
  entity_detection?: boolean;
  word_boost?: string[];
  boost_param?: 'low' | 'default' | 'high';
}

// Legacy type alias for backward compatibility
export type DeepgramConfig = STTConfig;

export const DEFAULT_DEEPGRAM_CONFIG: STTConfig = {
  provider: 'deepgram',
  model: 'nova-2',
  punctuate: true,
  numerals: true,
  profanity_filter: false,
  language: 'en',
  smart_format: false,
  filler_words: false,
  keywords: 'payment code, account number, confirmation, reference, dash, guion, raya',
  detect_language: false,
  redact: [],
  utterances: false,
  replace: {
    'dash': '-',
    'Dash': '-',
    'at': '@',
    'At': '@',
    'dollar': '$',
    'dólar': '$',
    'guion': '-',
    'Guion': '-',
    'guión': '-',
    'Guión': '-',
    'raya': '-',
    'Raya': '-',
    'menos': '-',
    'Menos': '-',
    'arroba': '@',
    'Arroba': '@',
    'email': 'email',
    'Email': 'email',
    'space': ' ',
    'Space': ' ',
    'punto': '.',
    'coma': ',',
  },
};

export const DEFAULT_ASSEMBLYAI_CONFIG: STTConfig = {
  provider: 'assemblyai',
  model: 'best',
  punctuate: true,
  numerals: true,
  profanity_filter: false,
  language: 'en',
  speaker_labels: false,
  entity_detection: false,
  word_boost: ['payment', 'code', 'account', 'dash', 'guion', 'raya'],
  boost_param: 'high',
};

export function buildDeepgramUrl(
  baseUrl: string,
  config: DeepgramConfig,
  language: string
): string {
  const params = new URLSearchParams();

  // Core formatting
  params.set('smart_format', String(config.smart_format));
  params.set('punctuate', String(config.punctuate));
  params.set('numerals', String(config.numerals));
  params.set('filler_words', String(config.filler_words));
  params.set('profanity_filter', 'false');
  params.set('diarize', 'false');

  // Language detection
  if (config.detect_language) {
    params.set('detect_language', 'true');
  } else {
    params.set('language', language);
  }

  // Model selection
  if (config.model && config.model !== 'base') {
    params.set('model', config.model);
  }

  // Keywords boost (if provided)
  if (config.keywords && config.keywords.trim()) {
    params.set('keywords', config.keywords.trim());
    params.set('keywords:intensifier', '3');
  }

  // Redaction (if provided)
  if (config.redact && config.redact.length > 0) {
    config.redact.forEach((item) => {
      params.append('redact', item);
    });
  }

  // Utterances
  if (config.utterances) {
    params.set('utterances', 'true');
  }

  // Replace (find and replace in transcript)
  if (config.replace && Object.keys(config.replace).length > 0) {
    Object.entries(config.replace).forEach(([find, replace]) => {
      if (find && replace !== undefined) {
        params.append('replace', `${find}:${replace}`);
      }
    });
  }

  return `${baseUrl}?${params.toString()}`;
}
