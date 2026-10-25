// The Gemini DecisionMaker for scripts/simulate-llm.ts. Dev tool only: it lives under scripts/,
// which Vite never bundles, and the key comes from this process's environment, never a VITE_ var.
// Each call is stateless: one generation's player never sees another's conversation.

import { ApiError, GoogleGenAI } from '@google/genai';
import { choicePrompt, journalPrompt } from './prompt';
import { QuotaError, type ChoiceRequest, type ChoiceResponse, type DecisionMaker, type JournalRequest, type Usage } from './types';

export class GeminiDecisionMaker implements DecisionMaker {
  private readonly ai: GoogleGenAI;

  constructor(
    readonly model: string,
    apiKey: string,
  ) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async choose(request: ChoiceRequest): Promise<ChoiceResponse> {
    const { system, user } = choicePrompt(request);
    const ids = request.candidates.map((c) => c.id);
    const { json, usage } = await this.generate(system, user, {
      type: 'object',
      properties: {
        choice: { type: 'string', enum: ids },
        repeat: { type: 'integer', minimum: 1 },
        note: { type: 'string' },
      },
      required: ['choice'],
    });
    const out: ChoiceResponse = { choice: typeof json.choice === 'string' ? json.choice : '', usage };
    if (typeof json.repeat === 'number') out.repeat = json.repeat;
    if (typeof json.note === 'string') out.note = json.note.slice(0, 300);
    return out;
  }

  async journal(request: JournalRequest): Promise<{ entry: string; usage?: Usage }> {
    const { system, user } = journalPrompt(request);
    const { json, usage } = await this.generate(system, user, {
      type: 'object',
      properties: { entry: { type: 'string' } },
      required: ['entry'],
    });
    return { entry: typeof json.entry === 'string' ? json.entry.slice(0, 400) : '', usage };
  }

  private async generate(system: string, user: string, schema: object): Promise<{ json: Record<string, unknown>; usage: Usage }> {
    let response;
    try {
      response = await this.ai.models.generateContent({
        model: this.model,
        contents: user,
        config: {
          systemInstruction: system,
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
          temperature: 0.8,
          maxOutputTokens: 300,
        },
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) throw new QuotaError(`Gemini quota or rate limit reached (${e.message.slice(0, 200)})`);
      throw e;
    }
    const meta = response.usageMetadata;
    const usage: Usage = {};
    if (meta?.promptTokenCount !== undefined) usage.promptTokens = meta.promptTokenCount;
    if (meta?.candidatesTokenCount !== undefined) usage.outputTokens = meta.candidatesTokenCount;
    if (meta?.totalTokenCount !== undefined) usage.totalTokens = meta.totalTokenCount;
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(response.text ?? '{}') as Record<string, unknown>;
    } catch {
      // Unparseable: the caller sees an empty choice and records it as a rejection.
    }
    return { json, usage };
  }
}
