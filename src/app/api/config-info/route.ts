/**
 * API endpoint: /api/config-info
 * 显示当前使用的配置信息（包括自动检测）
 */

import { NextResponse } from 'next/server';
import { getServerConfig } from '@/lib/config';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { votingCache } from '@/lib/server-cache';

export const runtime = 'nodejs'; // 需要Node.js runtime来读取文件

/**
 * 检测 Codex 配置（同步）
 */
function detectCodexConfigSync() {
  try {
    const codexDir = join(homedir(), '.codex');
    const authPath = join(codexDir, 'auth.json');
    const configPath = join(codexDir, 'config.toml');

    if (!existsSync(authPath) || !existsSync(configPath)) {
      return null;
    }

    // 读取 auth.json
    const authContent = readFileSync(authPath, 'utf-8');
    const auth = JSON.parse(authContent);
    const apiKey = auth.OPENAI_API_KEY;

    if (!apiKey) {
      return null;
    }

    // 读取 config.toml
    const configContent = readFileSync(configPath, 'utf-8');
    let baseUrl = 'https://api.openai.com/v1';

    const baseUrlMatch = configContent.match(/\[\s*model_providers\.cliproxyapi\s*\][\s\S]*?base_url\s*=\s*["']([^"']+)["']/);
    if (baseUrlMatch && baseUrlMatch[1]) {
      baseUrl = baseUrlMatch[1];
    }

    return {
      apiKey,
      baseUrl,
      source: 'codex',
    };
  } catch (error) {
    return null;
  }
}

/**
 * 检测 Claude 配置（同步）
 */
function detectClaudeConfigSync() {
  try {
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

    return {
      apiKey,
      baseUrl,
      source: 'claude',
    };
  } catch (error) {
    return null;
  }
}

export async function GET() {
  try {
    // Config info rarely changes - use longer cache TTL (5 minutes)
    const cacheKey = 'config-info';
    const cached = votingCache.get(cacheKey);

    if (cached) {
      return NextResponse.json({
        success: true,
        ...cached,
        cached: true,
      });
    }

    const config = getServerConfig();

    // 自动检测配置
    const claudeDetected = detectClaudeConfigSync();
    const openaiDetected = detectCodexConfigSync();

    // 生成检测报告
    const reportLines: string[] = [];
    reportLines.push('🔍 自动检测到的配置：\n');

    if (claudeDetected) {
      reportLines.push('✅ Claude配置（来自 ~/.claude/settings.json）:');
      reportLines.push(`   Base URL: ${claudeDetected.baseUrl}`);
      reportLines.push(`   API Key: ${claudeDetected.apiKey.substring(0, 10)}...`);
      reportLines.push('');
    } else {
      reportLines.push('❌ Claude配置未找到');
      reportLines.push('');
    }

    if (openaiDetected) {
      reportLines.push('✅ OpenAI/Codex配置（来自 ~/.codex/）:');
      reportLines.push(`   Base URL: ${openaiDetected.baseUrl}`);
      reportLines.push(`   API Key: ${openaiDetected.apiKey.substring(0, 10)}...`);
      reportLines.push('');
    } else {
      reportLines.push('❌ OpenAI/Codex配置未找到');
      reportLines.push('');
    }

    const report = reportLines.join('\n');

    const responseData = {
      config: {
        claude: {
          type: config.claude.type,
          baseUrl: config.claude.baseUrl,
          model: config.claude.model,
          hasApiKey: !!config.claude.apiKey,
          apiKeyPrefix: config.claude.apiKey ? config.claude.apiKey.substring(0, 10) + '...' : 'none',
        },
        openai: {
          type: config.openai.type,
          baseUrl: config.openai.baseUrl,
          model: config.openai.model,
          hasApiKey: !!config.openai.apiKey,
          apiKeyPrefix: config.openai.apiKey ? config.openai.apiKey.substring(0, 10) + '...' : 'none',
        },
      },
      detected: {
        claude: !!claudeDetected,
        openai: !!openaiDetected,
      },
      detectedConfigs: {
        claude: claudeDetected ? {
          baseUrl: claudeDetected.baseUrl,
          apiKeyPrefix: claudeDetected.apiKey.substring(0, 10) + '...',
          source: claudeDetected.source,
        } : null,
        openai: openaiDetected ? {
          baseUrl: openaiDetected.baseUrl,
          apiKeyPrefix: openaiDetected.apiKey.substring(0, 10) + '...',
          source: openaiDetected.source,
        } : null,
      },
      report,
    };

    // Store in cache (5 minute TTL - config rarely changes)
    votingCache.set(cacheKey, responseData, 300000);

    return NextResponse.json({
      success: true,
      ...responseData,
      cached: false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get config info',
      },
      { status: 500 }
    );
  }
}
