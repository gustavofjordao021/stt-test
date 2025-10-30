export interface DeepgramConfig {
  model: 'base' | 'nova-2' | 'nova-2-general' | 'enhanced';
  smart_format: boolean;
  filler_words: boolean;
  keywords: string | null;
  punctuate: boolean;
  numerals: boolean;
}

export const DEFAULT_DEEPGRAM_CONFIG: DeepgramConfig = {
  model: 'base',
  smart_format: true,
  filler_words: true,
  keywords: null,
  punctuate: true,
  numerals: true,
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
  params.set('language', language);

  // Model selection
  if (config.model && config.model !== 'base') {
    params.set('model', config.model);
  }

  // Keywords boost (if provided)
  if (config.keywords && config.keywords.trim()) {
    params.set('keywords', config.keywords.trim());
    params.set('keywords:intensifier', '3');
  }

  return `${baseUrl}?${params.toString()}`;
}
