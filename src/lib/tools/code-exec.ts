/**
 * exec_python 工具 — 在 docker 一次性容器里跑 Python 代码
 *
 * 网络隔离 (--network none)，内存/CPU 受限，stdin 传 code 避免引号注入，
 * 超时 kill。每次调用都是全新容器。仅用 Python stdlib（无 pip install）。
 */

import { spawn } from 'node:child_process';
import { ToolDefinition, ToolHandler } from './types';

export const execPythonToolDef: ToolDefinition = {
  name: 'exec_python',
  description:
    '在隔离沙箱里执行 Python 代码并返回 stdout/stderr。仅 Python 3.12 stdlib，没有网络。' +
    '当回答需要计算、模拟、解析、字符串处理、单位换算时使用，比口算更可靠。',
  parameters: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'Python 代码。print() 输出的内容会作为结果返回。' },
    },
    required: ['code'],
  },
};

export interface ExecPythonOptions {
  image?: string;       // 默认 python:3.12-slim
  timeoutMs?: number;   // 默认 10000
  memoryMb?: number;    // 默认 256
  cpus?: string;        // 默认 0.5
  /** 在 Windows 上，docker 必须通过 wsl 调用。指定 distro 名，未提供则直调 docker。 */
  wslDistro?: string;
}

const DEFAULTS = {
  image: 'python:3.12-slim',
  timeoutMs: 10000,
  memoryMb: 256,
  cpus: '0.5',
};

export function makeExecPythonHandler(opts: ExecPythonOptions = {}): ToolHandler {
  const { image = DEFAULTS.image, timeoutMs = DEFAULTS.timeoutMs, memoryMb = DEFAULTS.memoryMb, cpus = DEFAULTS.cpus, wslDistro } = opts;

  return async (rawArgs, ctx) => {
    const args = rawArgs as { code?: string };
    const code = args?.code ?? '';
    if (!code.trim()) return { id: '', ok: false, error: 'code is required' };

    const dockerArgs = [
      'run', '--rm', '-i',
      '--network', 'none',
      '-m', `${memoryMb}m`,
      '--cpus', cpus,
      image,
      'python', '-I', '-',     // -I isolated mode + read code from stdin
    ];

    const useWsl = wslDistro ?? (process.platform === 'win32' ? 'Ubuntu' : null);
    const cmd = useWsl ? 'wsl' : 'docker';
    const argv = useWsl ? ['-d', useWsl, '--', 'docker', ...dockerArgs] : dockerArgs;

    return await new Promise(resolve => {
      const child = spawn(cmd, argv, { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      let killed = false;

      const timer = setTimeout(() => {
        killed = true;
        child.kill('SIGKILL');
      }, timeoutMs);

      const abortHandler = () => {
        killed = true;
        child.kill('SIGKILL');
      };
      ctx.signal?.addEventListener('abort', abortHandler, { once: true });

      child.stdout.on('data', d => { stdout += d.toString(); if (stdout.length > 16 * 1024) stdout = stdout.slice(0, 16 * 1024); });
      child.stderr.on('data', d => { stderr += d.toString(); if (stderr.length > 8 * 1024) stderr = stderr.slice(0, 8 * 1024); });

      child.on('error', err => {
        clearTimeout(timer);
        ctx.signal?.removeEventListener('abort', abortHandler);
        resolve({ id: '', ok: false, error: `spawn failed: ${err.message}` });
      });

      child.on('close', code => {
        clearTimeout(timer);
        ctx.signal?.removeEventListener('abort', abortHandler);
        if (killed) {
          resolve({ id: '', ok: false, error: `execution killed (timeout ${timeoutMs}ms or aborted)` });
          return;
        }
        const out = stdout || '(no stdout)';
        const errPart = stderr ? `\n\n--- stderr ---\n${stderr}` : '';
        if (code !== 0) {
          resolve({ id: '', ok: false, error: `exit ${code}${errPart}` });
        } else {
          resolve({ id: '', ok: true, content: out + errPart });
        }
      });

      child.stdin.write(code);
      child.stdin.end();
    });
  };
}
