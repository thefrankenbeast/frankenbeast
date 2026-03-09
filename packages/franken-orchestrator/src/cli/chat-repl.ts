import type { InterviewIO } from '../planning/interview-loop.js';
import type { ConversationEngine, TurnResult } from '../chat/conversation-engine.js';
import type { TurnRunner, TurnRunResult } from '../chat/turn-runner.js';
import type { ISessionStore } from '../chat/session-store.js';
import type { TranscriptMessage } from '../chat/types.js';
import { ANSI } from '../logging/beast-logger.js';

const SLASH_COMMANDS = new Set([
  '/plan',
  '/run',
  '/status',
  '/diff',
  '/approve',
  '/session',
  '/quit',
]);

export interface ChatReplOptions {
  engine: ConversationEngine;
  turnRunner: TurnRunner;
  io: InterviewIO;
  projectId: string;
  sessionStore?: ISessionStore;
}

export class ChatRepl {
  private readonly engine: ConversationEngine;
  private readonly turnRunner: TurnRunner;
  private readonly io: InterviewIO;
  private readonly projectId: string;
  private readonly sessionStore: ISessionStore | undefined;
  private transcript: TranscriptMessage[] = [];
  private pendingApproval = false;

  constructor(opts: ChatReplOptions) {
    this.engine = opts.engine;
    this.turnRunner = opts.turnRunner;
    this.io = opts.io;
    this.projectId = opts.projectId;
    this.sessionStore = opts.sessionStore;
  }

  async start(): Promise<void> {
    this.loadExistingSession();
    this.io.display(`${ANSI.cyan}${ANSI.bold}frankenbeast chat${ANSI.reset} — type /quit to exit`);

    for (;;) {
      const input = await this.io.ask('you>');
      const trimmed = input.trim();

      if (trimmed === '') continue;

      if (trimmed.startsWith('/')) {
        const cmd = trimmed.split(/\s+/)[0]!.toLowerCase();
        if (cmd === '/quit') {
          this.saveSession();
          break;
        }
        if (SLASH_COMMANDS.has(cmd)) {
          await this.handleSlashCommand(cmd, trimmed);
          continue;
        }
      }

      await this.processTurn(trimmed);
    }
  }

  private async processTurn(input: string): Promise<void> {
    let result: TurnResult;
    try {
      result = await this.engine.processTurn(input, this.transcript);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.io.display(`${ANSI.red}Error: ${msg}${ANSI.reset}`);
      return;
    }

    // Append new messages to transcript
    this.transcript.push(...result.newMessages);

    const tierLabel = `${ANSI.dim}[${result.tier}]${ANSI.reset}`;

    switch (result.outcome.kind) {
      case 'reply':
        this.io.display(`${tierLabel} ${result.outcome.content}`);
        break;

      case 'execute':
        await this.handleExecute(result, tierLabel);
        break;

      case 'plan':
        this.io.display(
          `${tierLabel} ${ANSI.blue}Plan:${ANSI.reset} ${result.outcome.planSummary} (${result.outcome.chunkCount} chunks)`,
        );
        break;

      case 'clarify':
        this.io.display(
          `${tierLabel} ${ANSI.yellow}${result.outcome.question}${ANSI.reset}`,
        );
        if (result.outcome.options.length > 0) {
          this.io.display(
            `  Options: ${result.outcome.options.join(', ')}`,
          );
        }
        break;
    }
  }

  private async handleExecute(result: TurnResult, tierLabel: string): Promise<void> {
    const outcome = result.outcome;
    if (outcome.kind !== 'execute') return;

    this.io.display(`${tierLabel} ${ANSI.magenta}Executing:${ANSI.reset} ${outcome.taskDescription}`);

    let runResult: TurnRunResult;
    try {
      runResult = await this.turnRunner.run(outcome);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.io.display(`${ANSI.red}Execution error: ${msg}${ANSI.reset}`);
      return;
    }

    if (runResult.status === 'pending_approval') {
      this.pendingApproval = true;
      this.io.display(
        `${ANSI.yellow}${ANSI.bold}Approval required:${ANSI.reset} ${outcome.taskDescription}. Use /approve to continue.`,
      );
      return;
    }

    this.io.display(`${ANSI.green}${runResult.summary}${ANSI.reset}`);
  }

  private async handleSlashCommand(cmd: string, _raw: string): Promise<void> {
    switch (cmd) {
      case '/plan':
        this.io.display(`${ANSI.blue}Current plan: use the engine to create a plan.${ANSI.reset}`);
        break;
      case '/run':
        this.io.display(`${ANSI.magenta}Use natural language to describe what to execute.${ANSI.reset}`);
        break;
      case '/status':
        this.io.display(
          `${ANSI.cyan}Session:${ANSI.reset} project=${this.projectId} turns=${this.transcript.length}`,
        );
        break;
      case '/diff':
        this.io.display(`${ANSI.dim}No diff available in current session.${ANSI.reset}`);
        break;
      case '/approve':
        if (this.pendingApproval) {
          this.pendingApproval = false;
          this.io.display(`${ANSI.green}Approval granted.${ANSI.reset}`);
        } else {
          this.io.display(`${ANSI.dim}No pending approval.${ANSI.reset}`);
        }
        break;
      case '/session':
        this.io.display(
          `${ANSI.cyan}Project:${ANSI.reset} ${this.projectId}\n` +
          `${ANSI.cyan}Transcript:${ANSI.reset} ${this.transcript.length} messages`,
        );
        break;
    }
  }

  private loadExistingSession(): void {
    if (!this.sessionStore) return;
    const ids = this.sessionStore.list();
    for (const id of ids) {
      const session = this.sessionStore.get(id);
      if (session && session.projectId === this.projectId && session.state === 'active') {
        this.transcript = [...session.transcript];
        this.io.display(`${ANSI.dim}Resumed session ${id} (${session.transcript.length} messages)${ANSI.reset}`);
        return;
      }
    }
  }

  private saveSession(): void {
    if (!this.sessionStore) return;

    // Try to find existing session to update
    const ids = this.sessionStore.list();
    for (const id of ids) {
      const session = this.sessionStore.get(id);
      if (session && session.projectId === this.projectId && session.state === 'active') {
        session.transcript = this.transcript;
        session.updatedAt = new Date().toISOString();
        this.sessionStore.save(session);
        return;
      }
    }

    // No existing session — create one
    const session = this.sessionStore.create(this.projectId);
    session.transcript = this.transcript;
    session.updatedAt = new Date().toISOString();
    this.sessionStore.save(session);
  }
}
