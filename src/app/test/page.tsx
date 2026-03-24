'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';

export default function TestPage() {
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});
  const settings = useAppStore((state) => state.settings);
  const errors = useAppStore((state) => state.errors);

  const runTests = async () => {
    const results: Record<string, boolean> = {};

    // Test 1: 配置加载
    try {
      results['配置加载'] = !!(
        settings.claude.apiKey ||
        settings.openai.apiKey ||
        settings.claude.baseUrl ||
        settings.openai.baseUrl
      );
    } catch (e) {
      results['配置加载'] = false;
    }

    // Test 2: LocalStorage保存
    try {
      localStorage.setItem('test-key', 'test-value');
      const value = localStorage.getItem('test-key');
      results['LocalStorage保存'] = value === 'test-value';
      localStorage.removeItem('test-key');
    } catch (e) {
      results['LocalStorage保存'] = false;
    }

    // Test 3: API endpoint可访问性
    try {
      const claudeRes = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'test', debateState: { messages: [] } }),
      });
      results['Claude API可访问'] = claudeRes.status === 500 || claudeRes.status === 401; // 期望没有API key时返回错误
    } catch (e) {
      results['Claude API可访问'] = false;
    }

    try {
      const openaiRes = await fetch('/api/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'test', debateState: { messages: [] } }),
      });
      results['OpenAI API可访问'] = openaiRes.status === 500 || openaiRes.status === 401;
    } catch (e) {
      results['OpenAI API可访问'] = false;
    }

    // Test 4: 配置验证
    try {
      const hasClaudeKey = !!settings.claude.apiKey;
      const hasOpenAIKey = !!settings.openai.apiKey;
      results['API Keys配置'] = hasClaudeKey || hasOpenAIKey;
    } catch (e) {
      results['API Keys配置'] = false;
    }

    // Test 5: Zustand store
    try {
      const state = useAppStore.getState();
      results['状态管理'] = !!state.debateState && !!state.settings;
    } catch (e) {
      results['状态管理'] = false;
    }

    setTestResults(results);
  };

  const getPassCount = () => {
    return Object.values(testResults).filter(v => v).length;
  };

  const getTotalCount = () => {
    return Object.keys(testResults).length;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">🧪 测试页面</h1>
        <p className="text-gray-600 mb-8">验证所有功能是否正常工作</p>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <button
            onClick={runTests}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg"
          >
            运行测试
          </button>

          {Object.keys(testResults).length > 0 && (
            <div className="mt-4">
              <p className="text-lg font-semibold mb-2">
                测试结果: {getPassCount()}/{getTotalCount()} 通过
              </p>

              <div className="space-y-2">
                {Object.entries(testResults).map(([test, passed]) => (
                  <div
                    key={test}
                    className={`flex items-center gap-2 p-3 rounded ${
                      passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    <span className="text-xl">{passed ? '✅' : '❌'}</span>
                    <span className="font-medium">{test}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">当前配置</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Claude:</strong></p>
            <ul className="list-disc list-inside ml-4">
              <li>类型: {settings.claude.type === 'native' ? '官方API' : '第三方中转'}</li>
              <li>Base URL: {settings.claude.baseUrl}</li>
              <li>Model: {settings.claude.model}</li>
              <li>API Key: {settings.claude.apiKey ? '已配置' : '未配置'}</li>
            </ul>

            <p className="mt-4"><strong>OpenAI:</strong></p>
            <ul className="list-disc list-inside ml-4">
              <li>类型: {settings.openai.type === 'native' ? '官方API' : '第三方中转'}</li>
              <li>Base URL: {settings.openai.baseUrl}</li>
              <li>Model: {settings.openai.model}</li>
              <li>API Key: {settings.openai.apiKey ? '已配置' : '未配置'}</li>
            </ul>

            <p className="mt-4"><strong>会话预算:</strong> ${settings.sessionBudget}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">测试清单</h2>
          <ul className="space-y-2 text-sm">
            <li className={testResults['配置加载'] !== false ? 'text-green-600' : 'text-gray-600'}>
              ☐ 配置系统正常工作
            </li>
            <li className={testResults['LocalStorage保存'] !== false ? 'text-green-600' : 'text-gray-600'}>
              ☐ LocalStorage持久化正常
            </li>
            <li className={testResults['Claude API可访问'] !== false ? 'text-green-600' : 'text-gray-600'}>
              ☐ Claude API endpoint可访问
            </li>
            <li className={testResults['OpenAI API可访问'] !== false ? 'text-green-600' : 'text-gray-600'}>
              ☐ OpenAI API endpoint可访问
            </li>
            <li className={testResults['API Keys配置'] !== false ? 'text-green-600' : 'text-gray-600'}>
              ☐ API Keys已配置
            </li>
            <li className={testResults['状态管理'] !== false ? 'text-green-600' : 'text-gray-600'}>
              ☐ Zustand状态管理正常
            </li>
          </ul>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">手动测试建议</h3>
            <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
              <li>返回首页，输入测试问题</li>
              <li>验证Claude和OpenAI并行响应</li>
              <li>测试设置面板（修改配置、保存）</li>
              <li>测试"挑战此回复"功能</li>
              <li>刷新页面，验证对话历史恢复</li>
              <li>测试API失败场景（清空API key）</li>
            </ol>
          </div>
        </div>

        <div className="mt-6">
          <a
            href="/"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            ← 返回首页
          </a>
        </div>
      </div>
    </div>
  );
}
