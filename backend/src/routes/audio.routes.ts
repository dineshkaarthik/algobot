import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { VoiceService, VoiceError } from '../services/voice/voice.service.js';

export async function audioRoutes(app: FastifyInstance) {
  const voiceService = new VoiceService();

  /**
   * POST /audio/upload — Upload audio for server-side transcription
   */
  app.post('/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    const file = await request.file();

    if (!file) {
      return reply.status(400).send({
        error: { code: 'NO_FILE', message: 'No audio file provided' },
      });
    }

    // Validate file type
    const allowedTypes = ['audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/mp4', 'audio/mpeg', 'audio/x-m4a'];
    if (!allowedTypes.includes(file.mimetype)) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_FILE_TYPE',
          message: `Unsupported audio format: ${file.mimetype}. Use WAV, M4A, or MP3.`,
        },
      });
    }

    try {
      const buffer = await file.toBuffer();

      // Check file size (max 5MB)
      if (buffer.length > 5 * 1024 * 1024) {
        return reply.status(400).send({
          error: { code: 'FILE_TOO_LARGE', message: 'Audio file must be under 5MB' },
        });
      }

      const result = await voiceService.transcribeAudio(buffer, file.mimetype);

      return reply.send({
        audio_id: result.audioId,
        audio_url: result.audioUrl,
        transcription: result.transcription,
        duration_seconds: result.durationSeconds,
        language: result.language,
        confidence: result.confidence,
      });
    } catch (error) {
      if (error instanceof VoiceError) {
        return reply.status(422).send({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  });

  /**
   * POST /audio/tts — Generate speech from text
   */
  app.post('/tts', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { text?: string; voice?: string };

    if (!body.text || body.text.length === 0) {
      return reply.status(400).send({
        error: { code: 'NO_TEXT', message: 'No text provided for speech generation' },
      });
    }

    if (body.text.length > 4096) {
      return reply.status(400).send({
        error: { code: 'TEXT_TOO_LONG', message: 'Text must be under 4096 characters' },
      });
    }

    try {
      const result = await voiceService.textToSpeech(body.text, body.voice);

      return reply.send({
        audio_url: result.audioUrl,
        duration_seconds: result.durationSeconds,
        format: result.format,
      });
    } catch (error) {
      if (error instanceof VoiceError) {
        return reply.status(422).send({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  });
}
