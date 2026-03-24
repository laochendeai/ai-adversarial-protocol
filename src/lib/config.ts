/**
 * AI对抗协议 - 配置管理系统
 * AI Adversarial Protocol - Configuration Management
 *
 * 配置加载优先级：
 * 1. LocalStorage（Web UI设置）— 最高优先级
 * 2. .env.local — 开发环境默认配置
 * 3. 自动检测工具配置 — Codex, Claude等
 * 4. 硬编码默认值 — 兜底
 */

import { ProviderConfig, AppSettings } from './types';

// 服务端检测函数（仅在Node.js环境可用）
function detectCodexConfigSync() {
  if (typeof window !== 'undefined') {
    return null;
  }

  try {
    const { readFileSync, existsSync } = require('fs');
    const { join } = require('path');
    const { homedir } = require('os');

    const codexDir = join(homedir(), '.codex');
    const authPath = join(codexDir, 'auth.json');
    const configPath = join(codexDir, 'config.toml');

    if (!existsSync(authPath) || !existsSync(configPath)) {
      return null;
    }

    const authContent = readFileSync(authPath, 'utf-8');
    const auth = JSON.parse(authContent);
    const apiKey = auth.OPENAI_API_KEY;

    if (!apiKey) {
      return null;
    }

    const configContent = readFileSync(configPath, 'utf-8');
    let baseUrl = 'https://api.openai.com';
    let model = 'gpt-4o'; // 默认模型

    const baseUrlMatch = configContent.match(/\[\s*model_providers\.cliproxyapi\s*\][\s\S]*?base_url\s*=\s*["']([^"']+)["']/);
    if (baseUrlMatch && baseUrlMatch[1]) {
      baseUrl = baseUrlMatch[1];
      // 去掉 /v1 后缀（如果有的话），因为 client 会自动添加
      baseUrl = baseUrl.replace(/\/v1$/, '');
    }

    // 检测模型名称
    const modelMatch = configContent.match(/^model\s*=\s*["']?([^"'\r\n]+)["']?/m);
    if (modelMatch && modelMatch[1]) {
      model = modelMatch[1].trim();
    }

    return { apiKey, baseUrl, model };
  } catch (error) {
    return null;
  }
}

function detectClaudeConfigSync() {
  if (typeof window !== 'undefined') {
    return null;
  }

  try {
    const { readFileSync, existsSync } = require('fs');
    const { join } = require('path');
    const { homedir } = require('os');

    const settingsPath = join(homedir(), '.claude', 'settings.json');

    if (!existsSync(settingsPath)) {
      return null;
    }

    const content = readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(content);

    const apiKey = settings.env?.ANTHROPIC_AUTH_TOKEN;
    const baseUrl = settings.env?.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';

    if (!apiKey) {
      return null;
    }

    return { apiKey, baseUrl };
  } catch (error) {
    return null;
  }
}

// ========== 硬编码默认值（兜底） ==========
export const DEFAULT_SETTINGS: AppSettings = {
  claude: {
    type: 'native',
    apiKey: '',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-20250514',
  },
  openai: {
    type: 'native',
    apiKey: '',
    baseUrl: 'https://api.openai.com',
    model: 'gpt-4o',
  },
  sessionBudget: 5.0,
};

// ========== 自动检测配置（服务端） ==========
function getAutoDetectedConfig(): {
  claude?: { apiKey: string; baseUrl: string };
  openai?: { apiKey: string; baseUrl: string; model?: string };
} {
  if (typeof window !== 'undefined') {
    return {}; // 客户端返回空配置
  }

  const config: {
    claude?: { apiKey: string; baseUrl: string };
    openai?: { apiKey: string; baseUrl: string; model?: string };
  } = {};

  // 检测 Claude 配置
  const claudeConfig = detectClaudeConfigSync();
  if (claudeConfig) {
    config.claude = claudeConfig;
  }

  // 检测 Codex 配置
  const openaiConfig = detectCodexConfigSync();
  if (openaiConfig) {
    config.openai = openaiConfig;
  }

  return config;
}

// ========== 环境变量配置（服务端） ==========
function getEnvConfig(): AppSettings {
  const autoDetected = getAutoDetectedConfig();

  // 辅助函数：获取环境变量，如果为空则使用回退值
  const getEnvOrFallback = (envValue: string | undefined, fallback: string) => {
    return (envValue && envValue.trim()) || fallback;
  };

  return {
    claude: {
      type: 'native',
      apiKey: getEnvOrFallback(process.env.CLAUDE_API_KEY, autoDetected.claude?.apiKey || ''),
      baseUrl: getEnvOrFallback(process.env.CLAUDE_BASE_URL, autoDetected.claude?.baseUrl || 'https://api.anthropic.com'),
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
    },
    openai: {
      type: 'native',
      apiKey: getEnvOrFallback(process.env.OPENAI_API_KEY, autoDetected.openai?.apiKey || ''),
      baseUrl: getEnvOrFallback(process.env.OPENAI_BASE_URL, autoDetected.openai?.baseUrl || 'https://api.openai.com'),
      model: process.env.OPENAI_MODEL || autoDetected.openai?.model || 'gpt-4o',
    },
    sessionBudget: process.env.SESSION_BUDGET
      ? parseFloat(process.env.SESSION_BUDGET)
      : 5.0,
  };
}

// ========== LocalStorage配置（客户端） ==========
const STORAGE_KEY = 'ai-adversarial-settings';

export function saveSettings(settings: AppSettings): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }
}

export function loadSettings(): AppSettings | null {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse settings from localStorage:', e);
        return null;
      }
    }
  }
  return null;
}

export function clearSettings(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// ========== 统一配置加载（客户端） ==========
/**
 * 获取最终配置（客户端）
 * 优先级：LocalStorage > 硬编码默认值
 */
export function getClientConfig(): AppSettings {
  const stored = loadSettings();
  if (stored) {
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
    };
  }
  return DEFAULT_SETTINGS;
}

// ========== 统一配置加载（服务端） ==========
/**
 * 获取最终配置（服务端）
 * 优先级：环境变量 > 硬编码默认值
 */
export function getServerConfig(): AppSettings {
  const envConfig = getEnvConfig();
  return {
    ...DEFAULT_SETTINGS,
    ...envConfig,
  };
}

// ========== Provider配置覆盖 ==========
/**
 * 合并Provider配置
 * 如果override提供了某个字段，使用override的值
 */
export function mergeProviderConfig(
  base: ProviderConfig,
  override?: Partial<ProviderConfig>
): ProviderConfig {
  if (!override) return base;
  return {
    ...base,
    ...override,
  };
}

// ========== 配置验证 ==========
/**
 * 验证Provider配置是否完整
 */
export function validateProviderConfig(config: ProviderConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.apiKey) {
    errors.push('API Key is required');
  }

  if (config.type === 'custom' && !config.baseUrl) {
    errors.push('Base URL is required for custom provider');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证应用设置是否完整
 */
export function validateSettings(settings: AppSettings): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const claudeValidation = validateProviderConfig(settings.claude);
  if (!claudeValidation.valid) {
    errors.push(...claudeValidation.errors.map(e => `Claude: ${e}`));
  }

  const openaiValidation = validateProviderConfig(settings.openai);
  if (!openaiValidation.valid) {
    errors.push(...openaiValidation.errors.map(e => `OpenAI: ${e}`));
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
