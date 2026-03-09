import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatRepl } from '../../../src/cli/chat-repl.js';

// Mock ConversationEngine
const mockProcessTurn = vi.fn().mockResolvedValue({
  outcome: { kind: 'reply', content: 'Hello!', modelTier: 'cheap' },
  tier: 'cheap',
  newMessages: [
    { role: 'user', content: 'hello', timestamp: new Date().toISOString() },
    { role: 'assistant', content: 'Hello!', timestamp: new Date().toISOString(), modelTier: 'cheap' },
  ],
});

// Mock TurnRunner
const mockRunTurn = vi.fn().mockResolvedValue({
  status: 'completed',
  summary: 'Done',
  events: [],
});

// Mock IO
function mockIO() {
  const inputs: string[] = [];
  const outputs: string[] = [];
  return {
    pushInput: (line: string) => inputs.push(line),
    inputs,
    outputs,
    io: {
      ask: vi.fn(() => Promise.resolve(inputs.shift() ?? '/quit')),
      display: vi.fn((msg: string) => outputs.push(msg)),
    },
  };
}

describe('ChatRepl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes a simple reply turn and displays response', async () => {
    const { io, outputs, pushInput } = mockIO();
    pushInput('hello');
    pushInput('/quit');

    const repl = new ChatRepl({
      engine: { processTurn: mockProcessTurn } as any,
      turnRunner: { run: mockRunTurn } as any,
      io: io,
      projectId: 'test',
    });
    await repl.start();

    expect(mockProcessTurn).toHaveBeenCalledWith('hello', expect.any(Array));
    expect(outputs.some(o => o.includes('Hello!'))).toBe(true);
  });

  it('recognizes /quit and exits', async () => {
    const { io } = mockIO();
    const repl = new ChatRepl({
      engine: { processTurn: mockProcessTurn } as any,
      turnRunner: { run: mockRunTurn } as any,
      io: io,
      projectId: 'test',
    });
    await repl.start();
    // Should exit cleanly without error
  });

  it('does not send slash commands to the engine', async () => {
    const { io, pushInput } = mockIO();
    pushInput('/status');
    pushInput('/quit');

    const repl = new ChatRepl({
      engine: { processTurn: mockProcessTurn } as any,
      turnRunner: { run: mockRunTurn } as any,
      io: io,
      projectId: 'test',
    });
    await repl.start();

    // /status should not call the engine
    const engineCalls = mockProcessTurn.mock.calls.filter(
      ([input]: [string]) => input === '/status'
    );
    expect(engineCalls).toHaveLength(0);
  });

  it('displays model tier with each response', async () => {
    const { io, outputs, pushInput } = mockIO();
    pushInput('hello');
    pushInput('/quit');

    const repl = new ChatRepl({
      engine: { processTurn: mockProcessTurn } as any,
      turnRunner: { run: mockRunTurn } as any,
      io: io,
      projectId: 'test',
    });
    await repl.start();

    expect(outputs.some(o => o.includes('cheap'))).toBe(true);
  });

  it('delegates execute outcomes to TurnRunner', async () => {
    mockProcessTurn.mockResolvedValueOnce({
      outcome: { kind: 'execute', taskDescription: 'Fix bug', approvalRequired: false },
      tier: 'premium_execution',
      newMessages: [{ role: 'user', content: 'fix the bug', timestamp: new Date().toISOString() }],
    });

    const { io, pushInput } = mockIO();
    pushInput('fix the bug');
    pushInput('/quit');

    const repl = new ChatRepl({
      engine: { processTurn: mockProcessTurn } as any,
      turnRunner: { run: mockRunTurn } as any,
      io: io,
      projectId: 'test',
    });
    await repl.start();

    expect(mockRunTurn).toHaveBeenCalled();
  });

  it('displays plan summary for plan outcomes', async () => {
    mockProcessTurn.mockResolvedValueOnce({
      outcome: { kind: 'plan', planSummary: 'Refactor auth module', chunkCount: 3 },
      tier: 'premium_reasoning',
      newMessages: [{ role: 'user', content: 'plan refactor', timestamp: new Date().toISOString() }],
    });

    const { io, outputs, pushInput } = mockIO();
    pushInput('plan refactor');
    pushInput('/quit');

    const repl = new ChatRepl({
      engine: { processTurn: mockProcessTurn } as any,
      turnRunner: { run: mockRunTurn } as any,
      io: io,
      projectId: 'test',
    });
    await repl.start();

    expect(outputs.some(o => o.includes('Refactor auth module'))).toBe(true);
  });

  it('displays clarification question for clarify outcomes', async () => {
    mockProcessTurn.mockResolvedValueOnce({
      outcome: { kind: 'clarify', question: 'Which database?', options: ['postgres', 'sqlite'] },
      tier: 'cheap',
      newMessages: [{ role: 'user', content: 'set up db', timestamp: new Date().toISOString() }],
    });

    const { io, outputs, pushInput } = mockIO();
    pushInput('set up db');
    pushInput('/quit');

    const repl = new ChatRepl({
      engine: { processTurn: mockProcessTurn } as any,
      turnRunner: { run: mockRunTurn } as any,
      io: io,
      projectId: 'test',
    });
    await repl.start();

    expect(outputs.some(o => o.includes('Which database?'))).toBe(true);
  });

  it('surfaces approval prompts for approvalRequired execute outcomes', async () => {
    mockProcessTurn.mockResolvedValueOnce({
      outcome: { kind: 'execute', taskDescription: 'Delete production data', approvalRequired: true },
      tier: 'premium_execution',
      newMessages: [{ role: 'user', content: 'delete data', timestamp: new Date().toISOString() }],
    });

    const mockRunner = {
      run: mockRunTurn.mockResolvedValueOnce({
        status: 'pending_approval',
        summary: 'Approval required: Delete production data',
        events: [{ type: 'approval_request', data: { taskDescription: 'Delete production data' } }],
      }),
    };

    const { io, outputs, pushInput } = mockIO();
    pushInput('delete data');
    pushInput('/quit');

    const repl = new ChatRepl({
      engine: { processTurn: mockProcessTurn } as any,
      turnRunner: mockRunner as any,
      io: io,
      projectId: 'test',
    });
    await repl.start();

    expect(outputs.some(o => o.includes('Approval required') || o.includes('approve'))).toBe(true);
  });

  it('handles /session command without crashing', async () => {
    const { io, pushInput } = mockIO();
    pushInput('/session');
    pushInput('/quit');

    const repl = new ChatRepl({
      engine: { processTurn: mockProcessTurn } as any,
      turnRunner: { run: mockRunTurn } as any,
      io: io,
      projectId: 'test',
    });
    await repl.start();
    // Should not throw
  });

  it('maintains transcript across turns', async () => {
    const { io, pushInput } = mockIO();
    pushInput('first message');
    pushInput('second message');
    pushInput('/quit');

    const repl = new ChatRepl({
      engine: { processTurn: mockProcessTurn } as any,
      turnRunner: { run: mockRunTurn } as any,
      io: io,
      projectId: 'test',
    });
    await repl.start();

    // Second call should have history from first turn
    const secondCall = mockProcessTurn.mock.calls[1];
    expect(secondCall).toBeDefined();
    expect(secondCall[1].length).toBeGreaterThan(0);
  });
});
