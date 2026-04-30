/**
 * HTTP Server 启动入口
 */

import { Hono } from 'hono';
import { serve, ServerType } from '@hono/node-server';
import { EngineHub } from '@/engine/EngineHub';
import { createOpenAIRoutes } from '@/server/routes/openai-compat';
import { createAnthropicRoutes } from '@/server/routes/anthropic-compat';

export interface StartServerOptions {
  hub: EngineHub;
  port: number;
  host: string;
}

export interface ServerHandle {
  close: () => Promise<void>;
  url: string;
}

export function startServer(options: StartServerOptions): ServerHandle {
  const { hub, port, host } = options;
  const app = new Hono();

  app.get('/', c => c.json({ name: 'ai-adversarial-protocol', version: '1.0.0' }));
  app.get('/health', c => c.json({ ok: true, activeRuns: hub.getActiveRuns().length }));

  // 挂载子路由
  app.route('/', createOpenAIRoutes(hub));
  app.route('/', createAnthropicRoutes(hub));

  const server: ServerType = serve({ fetch: app.fetch, port, hostname: host });

  return {
    url: `http://${host}:${port}`,
    close: () =>
      new Promise<void>(resolve => {
        // @hono/node-server 返回的 server 是 Node http.Server
        if ('close' in server && typeof (server as { close: (cb?: () => void) => void }).close === 'function') {
          (server as { close: (cb?: () => void) => void }).close(() => resolve());
        } else {
          resolve();
        }
      }),
  };
}
