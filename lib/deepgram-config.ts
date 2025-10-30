export interface DeepgramConfig {
  model: 'base' | 'nova-2' | 'nova-2-general' | 'enhanced';
  smart_format: boolean;
  filler_words: boolean;
  keywords: string | null;
  punctuate: boolean;
  numerals: boolean;
  detect_language: boolean;
  redact: string[];
  utterances: boolean;
  replace: Record<string, string>; // Find and replace terms in transcript
}

export const DEFAULT_DEEPGRAM_CONFIG: DeepgramConfig = {
  model: 'base',
  smart_format: true,
  filler_words: true,
  keywords: null,
  punctuate: true,
  numerals: true,
  detect_language: false,
  redact: [],
  utterances: false,
  replace: {},
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
