/**
 * 配置同步工具
 * 用于将服务器端检测到的配置同步到客户端 LocalStorage
 */

import { AppSettings } from './types';
import { saveSettings, loadSettings } from './config';

export interface ServerConfigInfo {
  claude: {
    type: string;
    baseUrl: string;
    model: string;
    hasApiKey: boolean;
    apiKeyPrefix: string;
  };
  openai: {
    type: string;
    baseUrl: string;
    model: string;
    hasApiKey: boolean;
    apiKeyPrefix: string;
  };
  detected: {
    claude: boolean;
    openai: boolean;
  };
}

/**
 * 从服务器获取配置信息
 */
export async function fetchServerConfig(): Promise<ServerConfigInfo | null> {
  try {
    const response = await fetch('/api/config-info');
    const data = await response.json();
    if (data.success) {
      return data.config;
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch server config:', error);
    return null;
  }
}

/**
 * 检查服务器端配置是否与客户端配置不同
 */
export function isConfigDifferent(serverConfig: ServerConfigInfo): boolean {
  const clientConfig = loadSettings();
  if (!clientConfig) return true;

  // 检查关键配置是否不同
  const checks = [
    serverConfig.claude.baseUrl !== clientConfig.claude.baseUrl,
    serverConfig.openai.baseUrl !== clientConfig.openai.baseUrl,
    serverConfig.claude.model !== clientConfig.claude.model,
    serverConfig.openai.model !== clientConfig.openai.model,
  ];

  return checks.some(check => check);
}

/**
 * 同步服务器端配置到客户端 LocalStorage
 * 注意：由于安全原因，我们不会同步 API key，只同步 type、baseUrl、model
 */
export function syncServerConfig(serverConfig: ServerConfigInfo): AppSettings {
  const currentConfig = loadSettings();

  const newConfig: AppSettings = {
    claude: {
      type: serverConfig.claude.baseUrl.includes('api.anthropic.com') ? 'native' : 'custom',
      apiKey: currentConfig?.claude.apiKey || '',
      baseUrl: serverConfig.claude.baseUrl,
      model: serverConfig.claude.model,
    },
    openai: {
      type: serverConfig.openai.baseUrl.includes('api.openai.com') ? 'native' : 'custom',
      apiKey: currentConfig?.openai.apiKey || '',
      baseUrl: serverConfig.openai.baseUrl,
      model: serverConfig.openai.model,
    },
    gemini: currentConfig?.gemini || {
      type: 'native' as const,
      apiKey: '',
      baseUrl: 'https://generativelanguage.googleapis.com',
      model: 'gemini-2.5-flash',
    },
    local: currentConfig?.local || {
      type: 'native' as const,
      apiKey: '',
      baseUrl: 'http://localhost:11434',
      model: 'llama3.2',
    },
    sessionBudget: currentConfig?.sessionBudget || 5.0,
  };

  saveSettings(newConfig);
  return newConfig;
}

/**
 * 自动检测并应用服务器端配置
 * 返回是否应用了新配置
 */
export async function autoApplyServerConfig(): Promise<boolean> {
  const serverConfig = await fetchServerConfig();
  if (!serverConfig) return false;

  if (isConfigDifferent(serverConfig)) {
    syncServerConfig(serverConfig);
    return true;
  }

  return false;
}
