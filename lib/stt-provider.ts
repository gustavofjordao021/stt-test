import { STTConfig } from './deepgram-config';

export interface STTResponse {
    transcript: string;
    confidence: number;
    raw: any;
}

export interface STTProvider {
    transcribe(audio: Blob, config: STTConfig, language: string): Promise<STTResponse>;
}

class DeepgramProvider implements STTProvider {
    async transcribe(audio: Blob, config: STTConfig, language: string): Promise<STTResponse> {
        const url = this.buildApiUrl(config, language);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
                'Content-Type': 'audio/webm',
            },
            body: audio,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Deepgram API error: ${error}`);
        }

        const data = await response.json();
        return this.formatResponse(data);
    }

    private buildApiUrl(config: STTConfig, language: string): string {
        const baseUrl = 'https://api.deepgram.com/v1/listen';
        const params = new URLSearchParams();

        // Core formatting
        params.set('smart_format', String(config.smart_format ?? false));
        params.set('punctuate', String(config.punctuate));
        params.set('numerals', String(config.numerals));
        params.set('filler_words', String(config.filler_words ?? false));
        params.set('profanity_filter', String(config.profanity_filter));
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

        // Keywords boost
        if (config.keywords && config.keywords.trim()) {
            params.set('keywords', config.keywords.trim());
            params.set('keywords:intensifier', '3');
        }

        // Redaction
        if (config.redact && config.redact.length > 0) {
            config.redact.forEach((item) => {
                params.append('redact', item);
            });
        }

        // Utterances
        if (config.utterances) {
            params.set('utterances', 'true');
        }

        // Replace rules
        if (config.replace && Object.keys(config.replace).length > 0) {
            Object.entries(config.replace).forEach(([find, replace]) => {
                if (find && replace !== undefined) {
                    params.append('replace', `${find}:${replace}`);
                }
            });
        }

        return `${baseUrl}?${params.toString()}`;
    }

    private formatResponse(raw: any): STTResponse {
        const channel = raw.results?.channels?.[0];
        const alternative = channel?.alternatives?.[0];

        return {
            transcript: alternative?.transcript || '',
            confidence: alternative?.confidence || 0,
            raw,
        };
    }
}

class AssemblyAIProvider implements STTProvider {
    async transcribe(audio: Blob, config: STTConfig, language: string): Promise<STTResponse> {
        // Step 1: Upload audio
        const uploadUrl = await this.uploadAudio(audio);

        // Step 2: Submit transcription job
        const transcriptId = await this.submitTranscription(uploadUrl, config, language);

        // Step 3: Poll for completion
        const result = await this.pollForCompletion(transcriptId);

        return this.formatResponse(result);
    }

    private async uploadAudio(audio: Blob): Promise<string> {
        const response = await fetch('https://api.assemblyai.com/v2/upload', {
            method: 'POST',
            headers: {
                'authorization': process.env.ASSEMBLYAI_API_KEY!,
            },
            body: audio,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`AssemblyAI upload error: ${error}`);
        }

        const data = await response.json();
        return data.upload_url;
    }

    private async submitTranscription(audioUrl: string, config: STTConfig, language: string): Promise<string> {
        const response = await fetch('https://api.assemblyai.com/v2/transcript', {
            method: 'POST',
            headers: {
                'authorization': process.env.ASSEMBLYAI_API_KEY!,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                audio_url: audioUrl,
                language_code: language === 'es' ? 'es' : 'en_us',
                punctuate: config.punctuate,
                format_text: config.numerals, // Maps to format_text
                filter_profanity: config.profanity_filter,
                speaker_labels: config.speaker_labels ?? false,
                entity_detection: config.entity_detection ?? false,
                word_boost: config.word_boost ?? [],
                boost_param: config.boost_param ?? 'default',
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`AssemblyAI transcription error: ${error}`);
        }

        const data = await response.json();
        return data.id;
    }

    private async pollForCompletion(transcriptId: string): Promise<any> {
        const maxAttempts = 60; // 60 seconds timeout
        let attempts = 0;

        while (attempts < maxAttempts) {
            const response = await fetch(
                `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
                {
                    headers: {
                        'authorization': process.env.ASSEMBLYAI_API_KEY!,
                    },
                }
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`AssemblyAI polling error: ${error}`);
            }

            const data = await response.json();

            if (data.status === 'completed') return data;
            if (data.status === 'error') {
                throw new Error(`AssemblyAI transcription failed: ${data.error}`);
            }

            // Wait 1 second before polling again
            await new Promise((resolve) => setTimeout(resolve, 1000));
            attempts++;
        }

        throw new Error('AssemblyAI transcription timeout (60s)');
    }

    private formatResponse(raw: any): STTResponse {
        return {
            transcript: raw.text || '',
            confidence: raw.confidence || 0,
            raw,
        };
    }
}

// Factory function
export function getSTTProvider(provider: 'deepgram' | 'assemblyai'): STTProvider {
    switch (provider) {
        case 'deepgram':
            return new DeepgramProvider();
        case 'assemblyai':
            return new AssemblyAIProvider();
        default:
            throw new Error(`Unknown STT provider: ${provider}`);
    }
}

