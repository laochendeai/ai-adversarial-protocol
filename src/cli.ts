/**
 * aap CLI 入口
 *
 * 默认行为：同时启动 TUI + HTTP Server
 * 子命令：
 *   aap                — 启动 TUI + Server（默认）
 *   aap --no-tui       — 仅 server（headless）
 *   aap --no-server    — 仅 TUI
 *   aap config <op>    — 配置管理
 */

import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import { loadConfig, saveConfig, addModel, removeModel, updateModel, DEFAULT_STORAGE_DIR } from '@/config/loader';
import { ModelConfig, ModelProtocol } from '@/lib/types';
import { EngineHub } from '@/engine/EngineHub';
import { startServer } from '@/server/index';
import { App } from '@/tui/App';

const program = new Command();
program
  .name('aap')
  .description('AI Adversarial Protocol — multi-model adversarial CLI/server')
  .version('1.0.0');

program
  .option('--no-tui', '不启动交互式 TUI')
  .option('--no-server', '不启动 HTTP server')
  .option('-p, --port <port>', 'HTTP server 端口', v => parseInt(v, 10))
  .option('-h, --host <host>', 'HTTP server 监听地址')
  .action(async opts => {
    await runDefault(opts);
  });

// ===== config 子命令 =====
const configCmd = program.command('config').description('管理 ~/.aap/config.json');

configCmd
  .command('list')
  .description('列出所有模型配置')
  .action(() => {
    const cfg = loadConfig();
    if (cfg.models.length === 0) {
      console.log('(无模型配置，使用 aap config add 添加)');
      return;
    }
    console.log(`存储目录: ${cfg.storageDir}`);
    console.log(`服务器: ${cfg.server.host}:${cfg.server.port}`);
    console.log(`模型 (${cfg.models.length}):`);
    for (const m of cfg.models) {
      const flag = m.enabled ? '✓' : '✗';
      console.log(
        `  ${flag} ${m.id.padEnd(20)} ${m.protocol.padEnd(10)} ${m.model.padEnd(30)} ${m.baseUrl}`
      );
    }
  });

configCmd
  .command('add <id>')
  .description('添加模型配置')
  .requiredOption('--protocol <protocol>', 'openai | anthropic | ollama')
  .requiredOption('--base-url <url>', 'API base URL')
  .option('--api-key <key>', 'API key (ollama 可省略)')
  .requiredOption('--model <model>', '上游模型名')
  .option('--weight <number>', '投票权重 (默认 1.0)', v => parseFloat(v))
  .option('--disabled', '添加但不启用')
  .action((id: string, opts) => {
    const protocol = opts.protocol as ModelProtocol;
    if (!['openai', 'anthropic', 'ollama'].includes(protocol)) {
      console.error(`Invalid protocol: ${protocol}`);
      process.exit(1);
    }
    const cfg = loadConfig();
    const model: ModelConfig = {
      id,
      protocol,
      baseUrl: opts.baseUrl,
      apiKey: opts.apiKey ?? '',
      model: opts.model,
      weight: opts.weight ?? 1.0,
      enabled: !opts.disabled,
    };
    try {
      const next = addModel(cfg, model);
      saveConfig(next);
      console.log(`✓ 已添加模型: ${id}`);
    } catch (err) {
      console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

configCmd
  .command('remove <id>')
  .description('删除模型配置')
  .action((id: string) => {
    const cfg = loadConfig();
    if (!cfg.models.some(m => m.id === id)) {
      console.error(`Model ${id} not found`);
      process.exit(1);
    }
    saveConfig(removeModel(cfg, id));
    console.log(`✓ 已删除: ${id}`);
  });

configCmd
  .command('enable <id>')
  .description('启用模型')
  .action((id: string) => {
    const cfg = loadConfig();
    saveConfig(updateModel(cfg, id, { enabled: true }));
    console.log(`✓ 已启用: ${id}`);
  });

configCmd
  .command('disable <id>')
  .description('禁用模型')
  .action((id: string) => {
    const cfg = loadConfig();
    saveConfig(updateModel(cfg, id, { enabled: false }));
    console.log(`✓ 已禁用: ${id}`);
  });

configCmd
  .command('path')
  .description('显示配置文件路径')
  .action(() => {
    console.log(`${DEFAULT_STORAGE_DIR}/config.json`);
  });

configCmd
  .command('init')
  .description('初始化配置文件（如果不存在）')
  .action(() => {
    const cfg = loadConfig();
    saveConfig(cfg);
    console.log(`✓ 配置已初始化: ${cfg.storageDir}/config.json`);
  });

program.parseAsync().catch(err => {
  console.error(err);
  process.exit(1);
});

async function runDefault(opts: { tui?: boolean; server?: boolean; port?: number; host?: string }) {
  const config = loadConfig();
  if (opts.port) config.server.port = opts.port;
  if (opts.host) config.server.host = opts.host;

  const enableTui = opts.tui !== false;
  const enableServer = opts.server !== false;

  if (!enableTui && !enableServer) {
    console.error('--no-tui 和 --no-server 不能同时指定');
    process.exit(1);
  }

  if (config.models.filter(m => m.enabled).length === 0) {
    console.error('⚠ 没有启用的模型，请先运行: aap config add <id> ...');
    if (!enableTui) {
      // headless 模式直接退出
      process.exit(1);
    }
  }

  const hub = new EngineHub(config);

  let serverUrl: string | undefined;
  let serverHandle: ReturnType<typeof startServer> | undefined;
  if (enableServer) {
    serverHandle = startServer({ hub, port: config.server.port, host: config.server.host });
    serverUrl = serverHandle.url;
    if (!enableTui) {
      console.log(`AAP server listening at ${serverUrl}`);
      console.log('  GET  /v1/models');
      console.log('  POST /v1/chat/completions');
      console.log('  POST /v1/messages');
      console.log('Press Ctrl+C to stop.');
    }
  }

  if (enableTui) {
    const { waitUntilExit } = render(
      React.createElement(App, { hub, serverUrl }),
      { exitOnCtrlC: true }
    );
    await waitUntilExit();
    if (serverHandle) {
      await serverHandle.close();
    }
    process.exit(0);
  } else {
    // headless：保持进程
    process.on('SIGINT', async () => {
      if (serverHandle) await serverHandle.close();
      process.exit(0);
    });
  }
}
