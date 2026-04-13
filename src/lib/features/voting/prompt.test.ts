/**
 * Voting Prompt Generator Tests
 * 投票提示词生成器测试
 */

import { describe, it, expect } from 'vitest';
import {
  generateVotingPrompt,
  generateFactCheckPrompt,
  generateChallengeValidationPrompt,
  parseVotingResponse,
} from './prompt';
import type { VotingRequest, VoteTopic } from '@/lib/types';

describe('Voting Prompt Generator', () => {
  const mockMessages = [
    {
      id: 'msg-1',
      role: 'assistant' as const,
      provider: 'claude' as const,
      isClaude: true,
      content: '这是 Claude 的回答，详细阐述了问题的多个方面，包括技术细节和实际应用场景。',
      timestamp: Date.now(),
    },
    {
      id: 'msg-2',
      role: 'assistant' as const,
      provider: 'openai' as const,
      isClaude: false,
      content: 'OpenAI 的简洁回答，直接给出核心观点。',
      timestamp: Date.now(),
    },
  ];

  const mockTopic: VoteTopic = {
    id: 'topic-1',
    description: '哪个回答更好？',
    type: 'quality',
  };

  const mockRequest: VotingRequest = {
    messages: mockMessages,
    topic: mockTopic,
    context: '原始问题：什么是 AI？',
  };

  describe('generateVotingPrompt', () => {
    it('should generate complete voting prompt', () => {
      const prompt = generateVotingPrompt(mockRequest, 'claude');

      expect(prompt).toContain('AI投票系统');
      expect(prompt).toContain('原始问题:');
      expect(prompt).toContain('什么是 AI？');
      expect(prompt).toContain('投票任务:');
      expect(prompt).toContain('哪个回答更好？');
      expect(prompt).toContain('候选答案:');
    });

    it('should include message content and IDs', () => {
      const prompt = generateVotingPrompt(mockRequest, 'claude');

      expect(prompt).toContain('选项 msg-1 (Claude)');
      expect(prompt).toContain('选项 msg-2 (OpenAI)');
      expect(prompt).toContain('这是 Claude 的回答');
      expect(prompt).toContain('OpenAI 的简洁回答');
    });

    it('should truncate long messages', () => {
      const longMessage = {
        id: 'msg-3',
        role: 'assistant' as const,
        provider: 'claude' as const,
        isClaude: true,
        content: 'A'.repeat(600),
        timestamp: Date.now(),
      };
      const requestWithLong: VotingRequest = {
        messages: [longMessage],
        topic: mockTopic,
      };

      const prompt = generateVotingPrompt(requestWithLong, 'claude');

      expect(prompt).toContain('...');
      // Should be truncated to about 500 chars plus ellipsis
      const match = prompt.match(/选项 msg-3[^"]*"([^"]+)"/);
      expect(match && match[1].length).toBeLessThanOrEqual(503); // 500 + '...'
    });

    it('should include voting requirements', () => {
      const prompt = generateVotingPrompt(mockRequest, 'claude');

      expect(prompt).toContain('投票要求:');
      expect(prompt).toContain('准确性、完整性、逻辑性、清晰度');
      expect(prompt).toContain('必须返回有效的JSON格式');
    });

    it('should describe expert-weighted mode when configured', () => {
      const prompt = generateVotingPrompt({
        ...mockRequest,
        config: {
          enabled: true,
          mode: 'expert-weighted',
          threshold: 0.7,
          tiebreaker: 'first',
          allowSelfVote: true,
          expertProvider: 'claude',
        },
        providers: ['claude', 'openai'],
      }, 'claude');

      expect(prompt).toContain('expert-weighted');
      expect(prompt).toContain('claude');
      expect(prompt).toContain('3 倍');
    });

    it('should include output format specification', () => {
      const prompt = generateVotingPrompt(mockRequest, 'claude');

      expect(prompt).toContain('输出格式:');
      expect(prompt).toContain('"choice":');
      expect(prompt).toContain('"confidence":');
      expect(prompt).toContain('"reasoning":');
    });

    it('should handle request without context', () => {
      const requestWithoutContext: VotingRequest = {
        messages: mockMessages,
        topic: mockTopic,
      };

      const prompt = generateVotingPrompt(requestWithoutContext, 'claude');

      expect(prompt).toContain('AI投票系统');
      expect(prompt).toContain('投票任务:');
      // Context section should not be present
      expect(prompt).not.toContain('原始问题:');
    });
  });

  describe('generateFactCheckPrompt', () => {
    it('should generate fact-check prompt with statement', () => {
      const prompt = generateFactCheckPrompt('地球是平的', '科学讨论中');

      expect(prompt).toContain('AI事实核查投票系统');
      expect(prompt).toContain('背景:');
      expect(prompt).toContain('科学讨论中');
      expect(prompt).toContain('待核查陈述:');
      expect(prompt).toContain('地球是平的');
    });

    it('should include fact-check requirements', () => {
      const prompt = generateFactCheckPrompt('测试陈述');

      expect(prompt).toContain('投票要求:');
      expect(prompt).toContain('判断该陈述是否正确');
      expect(prompt).toContain('事实准确性、逻辑合理性、有无明显错误');
    });

    it('should include valid choice options', () => {
      const prompt = generateFactCheckPrompt('测试陈述');

      expect(prompt).toContain('"correct"');
      expect(prompt).toContain('"incorrect"');
      expect(prompt).toContain('"uncertain"');
    });

    it('should work without context', () => {
      const prompt = generateFactCheckPrompt('测试陈述');

      expect(prompt).toContain('AI事实核查投票系统');
      expect(prompt).toContain('待核查陈述:');
      expect(prompt).not.toContain('背景:');
    });
  });

  describe('generateChallengeValidationPrompt', () => {
    it('should generate validation prompt with all components', () => {
      const prompt = generateChallengeValidationPrompt(
        '原始回答内容很详细，涵盖了多个方面',
        '你的回答缺少具体例子',
        'factual_error'
      );

      expect(prompt).toContain('评估一个AI挑刺是否合理');
      expect(prompt).toContain('原始回答:');
      expect(prompt).toContain('挑刺内容:');
      expect(prompt).toContain('factual_error');
    });

    it('should truncate original message', () => {
      const longOriginal = 'A'.repeat(500);
      const prompt = generateChallengeValidationPrompt(
        longOriginal,
        '挑战内容',
        'logical_error'
      );

      // Should contain truncation indicator
      expect(prompt).toContain('...');
      // Should contain the original message marker
      expect(prompt).toContain('原始回答:');
      // Original content should be present (though truncated)
      expect(prompt).toContain('AAAAAAAAAAAAAAA');
    });

    it('should include validation requirements', () => {
      const prompt = generateChallengeValidationPrompt(
        '原始回答',
        '挑战',
        'error'
      );

      expect(prompt).toContain('评估要求:');
      expect(prompt).toContain('判断该挑刺是否合理、准确、有价值');
      expect(prompt).toContain('事实基础、逻辑性、重要性');
    });

    it('should include valid choice options', () => {
      const prompt = generateChallengeValidationPrompt(
        '原始',
        '挑战',
        'error'
      );

      expect(prompt).toContain('"accept"');
      expect(prompt).toContain('"reject"');
      expect(prompt).toContain('"neutral"');
    });
  });

  describe('parseVotingResponse', () => {
    it('should parse valid JSON response', () => {
      const response = `{
        "choice": "msg-1",
        "confidence": 0.85,
        "reasoning": "回答更全面"
      }`;

      const result = parseVotingResponse(response, 'claude', 'topic-1');

      expect(result).toEqual({
        choice: 'msg-1',
        confidence: 0.85,
        reasoning: '回答更全面',
      });
    });

    it('should parse JSON from markdown code block', () => {
      const response = `\`\`\`json
{
  "choice": "msg-2",
  "confidence": 0.9,
  "reasoning": "更简洁"
}
\`\`\``;

      const result = parseVotingResponse(response, 'openai', 'topic-1');

      expect(result).toEqual({
        choice: 'msg-2',
        confidence: 0.9,
        reasoning: '更简洁',
      });
    });

    it('should parse JSON without markdown', () => {
      const response = `Some text before {"choice":"msg-1","confidence":0.7} some text after`;

      const result = parseVotingResponse(response, 'claude', 'topic-1');

      expect(result).toEqual({
        choice: 'msg-1',
        confidence: 0.7,
      });
    });

    it('should return null for invalid JSON', () => {
      const response = `This is not valid JSON at all`;

      const result = parseVotingResponse(response, 'claude', 'topic-1');

      expect(result).toBeNull();
    });

    it('should return null for malformed JSON', () => {
      const response = `{"choice": "msg-1", "confidence": }`;  // Invalid JSON

      const result = parseVotingResponse(response, 'claude', 'topic-1');

      expect(result).toBeNull();
    });

    it('should validate choice against provided options', () => {
      const response = `{"choice": "msg-3", "confidence": 0.5}`;
      const validOptions = ['msg-1', 'msg-2'];

      const result = parseVotingResponse(response, 'claude', 'topic-1', validOptions);

      expect(result).toBeNull();
    });

    it('should accept valid choice when options are provided', () => {
      const response = `{"choice": "msg-1", "confidence": 0.8}`;
      const validOptions = ['msg-1', 'msg-2'];

      const result = parseVotingResponse(response, 'claude', 'topic-1', validOptions);

      expect(result).toEqual({
        choice: 'msg-1',
        confidence: 0.8,
      });
    });

    it('should handle response with only choice field', () => {
      const response = `{"choice": "msg-1"}`;

      const result = parseVotingResponse(response, 'claude', 'topic-1');

      expect(result).toEqual({
        choice: 'msg-1',
      });
      expect(result?.confidence).toBeUndefined();
      expect(result?.reasoning).toBeUndefined();
    });

    it('should handle response with extra whitespace', () => {
      const response = `
        {
          "choice" : "msg-1" ,
          "confidence" : 0.75
        }
      `;

      const result = parseVotingResponse(response, 'claude', 'topic-1');

      expect(result).toEqual({
        choice: 'msg-1',
        confidence: 0.75,
      });
    });
  });
});
