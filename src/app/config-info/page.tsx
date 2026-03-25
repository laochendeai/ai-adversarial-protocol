'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { syncServerConfig, isConfigDifferent } from '@/lib/config-sync';

interface ConfigInfo {
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
}

export default function ConfigInfoPage() {
  const [config, setConfig] = useState<ConfigInfo | null>(null);
  const [detected, setDetected] = useState<{
    claude: boolean;
    openai: boolean;
  } | null>(null);
  const [report, setReport] = useState<string>('');
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    fetch('/api/config-info')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setConfig(data.config);
          setDetected(data.detected);
          setReport(data.report);
        }
      })
      .catch(err => {
        console.error('Failed to load config:', err);
      });
  }, []);

  const handleApplyConfig = () => {
    if (!config || !detected) return;
    syncServerConfig({ ...config, detected });
    setApplied(true);
    setTimeout(() => setApplied(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">🔧 配置信息</h1>
        <p className="text-gray-600 mb-8">当前AI对抗协议使用的配置</p>

        {config ? (
          <>
            {/* 检测状态 */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">✨ 自动检测结果</h2>
                {(detected?.claude || detected?.openai) && (
                  <button
                    onClick={handleApplyConfig}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                      applied
                        ? 'bg-green-500 text-white'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                  >
                    {applied ? '✅ 已应用' : '📥 应用此配置'}
                  </button>
                )}
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <pre className="text-sm text-green-800 whitespace-pre-wrap">{report}</pre>
              </div>
              {applied && (
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    ✅ 配置已保存到 LocalStorage，返回主页后将显示正确的配置类型。
                  </p>
                </div>
              )}
            </div>

            {/* Claude配置 */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-semibold">🤖 Claude配置</h2>
                {detected?.claude && (
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
                    ✅ 自动检测
                  </span>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex">
                  <span className="font-semibold w-32">类型:</span>
                  <span className={config.claude.type === 'custom' ? 'text-orange-600' : 'text-gray-700'}>
                    {config.claude.type === 'custom' ? '第三方中转' : '官方API'}
                  </span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-32">Base URL:</span>
                  <span className="text-gray-700 font-mono text-xs break-all">{config.claude.baseUrl}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-32">Model:</span>
                  <span className="text-gray-700">{config.claude.model}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-32">API Key:</span>
                  <span className={config.claude.hasApiKey ? 'text-green-600' : 'text-red-600'}>
                    {config.claude.hasApiKey ? `✅ ${config.claude.apiKeyPrefix}` : '❌ 未配置'}
                  </span>
                </div>
              </div>
            </div>

            {/* OpenAI配置 */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-semibold">🤖 OpenAI/Codex配置</h2>
                {detected?.openai && (
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
                    ✅ 自动检测
                  </span>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex">
                  <span className="font-semibold w-32">类型:</span>
                  <span className={config.openai.type === 'custom' ? 'text-orange-600' : 'text-gray-700'}>
                    {config.openai.type === 'custom' ? '第三方中转' : '官方API'}
                  </span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-32">Base URL:</span>
                  <span className="text-gray-700 font-mono text-xs break-all">{config.openai.baseUrl}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-32">Model:</span>
                  <span className="text-gray-700">{config.openai.model}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-32">API Key:</span>
                  <span className={config.openai.hasApiKey ? 'text-green-600' : 'text-red-600'}>
                    {config.openai.hasApiKey ? `✅ ${config.openai.apiKeyPrefix}` : '❌ 未配置'}
                  </span>
                </div>
              </div>
            </div>

            {/* 使用说明 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">💡 配置优先级</h3>
              <ol className="list-decimal list-inside text-sm text-blue-800 space-y-2">
                <li>
                  <strong>LocalStorage（Web UI设置）</strong> — 最高优先级
                  <p className="ml-6 text-blue-600">在&ldquo;设置&rdquo;面板中配置会覆盖其他配置</p>
                </li>
                <li>
                  <strong>.env.local</strong> — 手动配置
                  <p className="ml-6 text-blue-600">在 .env.local 中配置会覆盖自动检测</p>
                </li>
                <li>
                  <strong>自动检测</strong> — 免费配置！
                  <p className="ml-6 text-blue-600">自动复用 Codex 和 Claude 的配置</p>
                </li>
                <li>
                  <strong>硬编码默认值</strong> — 兜底
                  <p className="ml-6 text-blue-600">当以上都没有时使用</p>
                </li>
              </ol>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
              <span className="text-gray-600">加载配置信息...</span>
            </div>
          </div>
        )}

        <div className="mt-6">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            ← 返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
