import type { ILlmClient } from '@franken/types';
import type {
  ModelTierValue,
  TranscriptMessage,
  TurnOutcome,
  ReplyOutcome,
} from './types.js';
import { IntentRouter } from './intent-router.js';
import { EscalationPolicy } from './escalation-policy.js';
import { PromptBuilder } from './prompt-builder.js';

export interface TurnResult {
  outcome: TurnOutcome;
  tier: ModelTierValue;
  newMessages: TranscriptMessage[];
}

export interface ConversationEngineOptions {
  llm: ILlmClient;
  projectName: string;
  maxTranscriptLength?: number;
}

export class ConversationEngine {
  private readonly llm: ILlmClient;
  private readonly router: IntentRouter;
  private readonly policy: EscalationPolicy;
  private readonly promptBuilder: PromptBuilder;

  constructor({ llm, projectName, maxTranscriptLength }: ConversationEngineOptions) {
    this.llm = llm;
    this.router = new IntentRouter();
    this.policy = new EscalationPolicy();
    this.promptBuilder = new PromptBuilder({
      projectName,
      maxMessages: maxTranscriptLength,
    });
  }

  async processTurn(
    input: string,
    history: TranscriptMessage[],
  ): Promise<TurnResult> {
    const intent = this.router.classify(input);
    const { tier, outcome } = this.policy.evaluate(intent, input);

    const userMessage: TranscriptMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    if (outcome.kind === 'reply') {
      try {
        const prompt = this.promptBuilder.build([...history, userMessage]);
        const response = await this.llm.complete(prompt);
        const replyOutcome: ReplyOutcome = {
          kind: 'reply',
          content: response,
          modelTier: tier,
        };
        const assistantMessage: TranscriptMessage = {
          role: 'assistant',
          content: response,
          timestamp: new Date().toISOString(),
          modelTier: tier,
        };
        return {
          outcome: replyOutcome,
          tier,
          newMessages: [userMessage, assistantMessage],
        };
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        const errorOutcome: ReplyOutcome = {
          kind: 'reply',
          content: `Error: ${errorMsg}`,
          modelTier: tier,
        };
        return {
          outcome: errorOutcome,
          tier,
          newMessages: [userMessage],
        };
      }
    }

    // For execute, plan, clarify: return outcome immediately without calling LLM
    return {
      outcome,
      tier,
      newMessages: [userMessage],
    };
  }
}
