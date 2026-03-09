import { Hono } from 'hono';
import { ChatGateway } from '../gateway/chat-gateway.js';
import { slackRouter } from '../channels/slack/slack-router.js';
import { SessionMapper } from '../core/session-mapper.js';

export interface CommsAppOptions {
  gateway: ChatGateway;
  sessionMapper: SessionMapper;
  slack?: {
    signingSecret: string;
  };
}

export function createCommsApp(options: CommsAppOptions): Hono {
  const { gateway, sessionMapper, slack } = options;
  const app = new Hono();

  app.get('/health', (c) => c.json({ status: 'ok' }));

  if (slack) {
    app.route('/slack', slackRouter({
      gateway,
      sessionMapper,
      signingSecret: slack.signingSecret,
    }));
  }

  // Generic test/bridge route for development/verification
  app.post('/v1/comms/inbound', async (c) => {
    const body = await c.req.json();
    await gateway.handleInbound(body);
    return c.json({ accepted: true });
  });

  app.post('/v1/comms/action', async (c) => {
    const { channelType, sessionId, actionId } = await c.req.json();
    await gateway.handleAction(channelType, sessionId, actionId);
    return c.json({ accepted: true });
  });

  return app;
}
