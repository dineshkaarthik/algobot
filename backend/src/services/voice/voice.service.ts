/**
 * ════════════════════════════════════════════════════════════
 *  VOICE PROCESSING SERVICE
 * ════════════════════════════════════════════════════════════
 *
 *  Handles:
 *  1. Server-side Speech-to-Text (Whisper API fallback)
 *  2. Text-to-Speech generation for responses
 *  3. Audio file storage (S3)
 *  4. Transcription caching
 *
 *  Note: Primary STT happens on-device (Apple Speech /
 *  Android SpeechRecognizer). This service provides a
 *  server-side fallback for better accuracy and also
 *  handles TTS for response playback.
 * ════════════════════════════════════════════════════════════
 */

import { v4 as uuidv4 } from 'uuid';
import { getRedis } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';

interface TranscriptionResult {
  audioId: string;
  audioUrl: string;
  transcription: string;
  durationSeconds: number;
  language: string;
  confidence: number;
}

interface TTSResult {
  audioUrl: string;
  durationSeconds: number;
  format: string;
}

export class VoiceService {
  private openaiApiKey: string | undefined;

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
  }

  /**
   * Transcribe audio using OpenAI Whisper API
   * This is the server-side fallback when on-device STT is insufficient
   */
  async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<TranscriptionResult> {
    const audioId = `aud_${uuidv4()}`;

    // Check cache first (same audio hash → same transcription)
    const audioHash = this.hashBuffer(audioBuffer);
    const redis = getRedis();
    const cached = await redis.get(`transcription:${audioHash}`);
    if (cached) {
      logger.info({ audioId }, 'Transcription cache hit');
      return JSON.parse(cached);
    }

    let transcription: string;
    let confidence = 0.95;
    let durationSeconds = 0;
    let language = 'en';

    if (this.openaiApiKey) {
      // Use OpenAI Whisper API for high-accuracy transcription
      const formData = new FormData();

      const extension = mimeType.includes('wav') ? 'wav' : 'm4a';
      const blob = new Blob([audioBuffer], { type: mimeType });
      formData.append('file', blob, `audio.${extension}`);
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      formData.append('language', 'en');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.openaiApiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new VoiceError(`Whisper API error: ${response.status} ${errBody}`, 'TRANSCRIPTION_FAILED');
      }

      const result = (await response.json()) as any;
      transcription = result.text;
      durationSeconds = result.duration || 0;
      language = result.language || 'en';
    } else {
      // Fallback: return empty transcription with instruction
      throw new VoiceError(
        'Server-side transcription unavailable. Please use on-device speech recognition.',
        'NO_STT_PROVIDER',
      );
    }

    // Store audio in S3 (or local in dev)
    const audioUrl = await this.storeAudio(audioId, audioBuffer, mimeType);

    const result: TranscriptionResult = {
      audioId,
      audioUrl,
      transcription,
      durationSeconds,
      language,
      confidence,
    };

    // Cache for 1 hour
    await redis.setex(`transcription:${audioHash}`, 3600, JSON.stringify(result));

    logger.info(
      { audioId, duration: durationSeconds, textLength: transcription.length },
      'Audio transcribed successfully',
    );

    return result;
  }

  /**
   * Generate speech from text using OpenAI TTS API
   */
  async textToSpeech(text: string, voice?: string): Promise<TTSResult> {
    if (!this.openaiApiKey) {
      throw new VoiceError(
        'Text-to-speech unavailable. Please use on-device TTS.',
        'NO_TTS_PROVIDER',
      );
    }

    // Check cache
    const textHash = this.hashString(text + (voice || 'alloy'));
    const redis = getRedis();
    const cached = await redis.get(`tts:${textHash}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text.substring(0, 4096), // TTS has a 4096 char limit
        voice: voice || 'alloy', // alloy, echo, fable, onyx, nova, shimmer
        response_format: 'mp3',
        speed: 1.0,
      }),
    });

    if (!response.ok) {
      throw new VoiceError(`TTS API error: ${response.status}`, 'TTS_FAILED');
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const audioId = `tts_${uuidv4()}`;
    const audioUrl = await this.storeAudio(audioId, audioBuffer, 'audio/mpeg');

    // Estimate duration (rough: ~150 words per minute, ~5 chars per word)
    const estimatedDuration = Math.ceil((text.length / 5) / 150 * 60);

    const result: TTSResult = {
      audioUrl,
      durationSeconds: estimatedDuration,
      format: 'mp3',
    };

    // Cache for 24 hours
    await redis.setex(`tts:${textHash}`, 86400, JSON.stringify(result));

    return result;
  }

  /**
   * Store audio file (S3 in production, local in dev)
   */
  private async storeAudio(audioId: string, buffer: Buffer, mimeType: string): Promise<string> {
    const env = process.env.NODE_ENV;

    if (env === 'development') {
      // In dev, store locally and return a local URL
      const fs = await import('fs/promises');
      const path = await import('path');
      const dir = path.join(process.cwd(), 'uploads', 'audio');
      await fs.mkdir(dir, { recursive: true });

      const extension = mimeType.includes('wav') ? 'wav' : mimeType.includes('mpeg') ? 'mp3' : 'm4a';
      const filePath = path.join(dir, `${audioId}.${extension}`);
      await fs.writeFile(filePath, buffer);

      return `http://localhost:${process.env.PORT || 3000}/uploads/audio/${audioId}.${extension}`;
    }

    // Production: upload to S3
    // Using fetch to avoid adding the full AWS SDK as a dependency
    const bucket = process.env.AWS_S3_BUCKET || 'algo-audio';
    const region = process.env.AWS_REGION || 'us-east-1';
    const key = `audio/${audioId}`;

    // For production, use AWS SDK v3 or presigned URLs
    // Placeholder — in real deployment, use @aws-sdk/client-s3
    logger.info({ bucket, key }, 'Would upload to S3 in production');
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  /**
   * Hash a buffer for caching
   */
  private hashBuffer(buffer: Buffer): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 16);
  }

  /**
   * Hash a string for caching
   */
  private hashString(text: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(text).digest('hex').substring(0, 16);
  }
}

export class VoiceError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'VoiceError';
  }
}
