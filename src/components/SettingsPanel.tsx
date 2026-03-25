'use client';

import { useState, useEffect } from 'react';
import { useSettings, useAppStore } from '@/lib/store';
import { ProviderConfig } from '@/lib/types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const settings = useSettings();
  const updateSettings = useAppStore((state) => state.updateSettings);
  const resetSettings = useAppStore((state) => state.resetSettings);

  // 本地状态用于表单编辑
  const [claudeConfig, setClaudeConfig] = useState<ProviderConfig>(settings.claude);
  const [openaiConfig, setOpenaiConfig] = useState<ProviderConfig>(settings.openai);
  const [sessionBudget, setSessionBudget] = useState(settings.sessionBudget || 5.0);

  // 当settings变化时，同步到表单状态
  useEffect(() => {
    setClaudeConfig(settings.claude);
    setOpenaiConfig(settings.openai);
    setSessionBudget(settings.sessionBudget || 5.0);
  }, [settings]);

  const handleSave = () => {
    updateSettings({
      claude: claudeConfig,
      openai: openaiConfig,
      gemini: settings.gemini,
      local: settings.local,
      sessionBudget,
    });
    onClose();
  };

  const handleReset = () => {
    if (confirm('确定要恢复默认配置吗？这将清除LocalStorage中的所有设置。')) {
      resetSettings();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">⚙️ 设置</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Claude配置 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              📌 Claude配置
            </h3>

            <div className="space-y-4">
              {/* API模式选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API模式
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="claude-type"
                      checked={claudeConfig.type === 'native'}
                      onChange={(e) =>
                        setClaudeConfig({
                          ...claudeConfig,
                          type: e.target.checked ? 'native' : 'custom',
                          baseUrl: e.target.checked ? 'https://api.anthropic.com' : claudeConfig.baseUrl,
                        })
                      }
                      className="mr-2"
                    />
                    <span>官方API</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="claude-type"
                      checked={claudeConfig.type === 'custom'}
                      onChange={(e) =>
                        setClaudeConfig({
                          ...claudeConfig,
                          type: e.target.checked ? 'custom' : 'native',
                        })
                      }
                      className="mr-2"
                    />
                    <span>第三方中转</span>
                  </label>
                </div>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={claudeConfig.apiKey}
                  onChange={(e) =>
                    setClaudeConfig({ ...claudeConfig, apiKey: e.target.value })
                  }
                  placeholder="sk-ant-xxx"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Base URL */}
              {claudeConfig.type === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Base URL
                  </label>
                  <input
                    type="text"
                    value={claudeConfig.baseUrl || ''}
                    onChange={(e) =>
                      setClaudeConfig({ ...claudeConfig, baseUrl: e.target.value })
                    }
                    placeholder="https://api.example.com/v1"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Model */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Model
                </label>
                <input
                  type="text"
                  value={claudeConfig.model || ''}
                  onChange={(e) =>
                    setClaudeConfig({ ...claudeConfig, model: e.target.value })
                  }
                  placeholder="claude-sonnet-4-20250514"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* OpenAI配置 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              📌 OpenAI配置
            </h3>

            <div className="space-y-4">
              {/* API模式选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API模式
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="openai-type"
                      checked={openaiConfig.type === 'native'}
                      onChange={(e) =>
                        setOpenaiConfig({
                          ...openaiConfig,
                          type: e.target.checked ? 'native' : 'custom',
                          baseUrl: e.target.checked ? 'https://api.openai.com' : openaiConfig.baseUrl,
                        })
                      }
                      className="mr-2"
                    />
                    <span>官方API</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="openai-type"
                      checked={openaiConfig.type === 'custom'}
                      onChange={(e) =>
                        setOpenaiConfig({
                          ...openaiConfig,
                          type: e.target.checked ? 'custom' : 'native',
                        })
                      }
                      className="mr-2"
                    />
                    <span>第三方中转</span>
                  </label>
                </div>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={openaiConfig.apiKey}
                  onChange={(e) =>
                    setOpenaiConfig({ ...openaiConfig, apiKey: e.target.value })
                  }
                  placeholder="sk-xxx"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Base URL */}
              {openaiConfig.type === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Base URL
                  </label>
                  <input
                    type="text"
                    value={openaiConfig.baseUrl || ''}
                    onChange={(e) =>
                      setOpenaiConfig({ ...openaiConfig, baseUrl: e.target.value })
                    }
                    placeholder="https://api.example.com/v1"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Model */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Model
                </label>
                <input
                  type="text"
                  value={openaiConfig.model || ''}
                  onChange={(e) =>
                    setOpenaiConfig({ ...openaiConfig, model: e.target.value })
                  }
                  placeholder="gpt-4o"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 会话预算 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              💰 会话预算
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                预算限制（美元）
              </label>
              <input
                type="number"
                step="0.01"
                value={sessionBudget}
                onChange={(e) => setSessionBudget(parseFloat(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                当API成本超过此金额时，将显示警告
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg"
          >
            保存并关闭
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={handleReset}
            className="bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-2 px-4 rounded-lg"
          >
            恢复默认
          </button>
        </div>
      </div>
    </div>
  );
}
