/**
 * 投票计算器 - 共识算法实现
 * Voting Calculator - Consensus Algorithm Implementation
 */

import { Vote, VotingResult, VotingConfig, AIProvider, AIProviderConfig } from '@/lib/types';

/**
 * 计算投票结果
 */
export function calculateVotingResult(
  votes: Vote[],
  options: string[],
  config: VotingConfig,
  providerConfigs: Record<AIProvider, AIProviderConfig>
): VotingResult {
  // 1. 统计每选项的得票（考虑权重）
  const totals: Record<string, number> = {};
  options.forEach(opt => totals[opt] = 0);

  votes.forEach(vote => {
    const weight = resolveVoteWeight(vote.voterId, config, providerConfigs);
    totals[vote.choice] = (totals[vote.choice] || 0) + weight;
  });

  // 2. 找出获胜者
  const entries = Object.entries(totals);
  const maxVotes = Math.max(...entries.map(([, v]) => v));
  const winners = entries.filter(([, v]) => v === maxVotes).map(([k]) => k);
  const isTie = winners.length > 1;
  const winner = isTie ? handleTie(winners, config.tiebreaker) : winners[0];

  // 3. 计算共识程度
  const consensusLevel = calculateConsensusLevel(totals, votes.length, config);

  // 4. 判断是否一致同意
  const isUnanimous = checkUnanimity(votes, winner);

  // 5. 判断是否需要人工审查
  const requiresReview = checkIfRequiresReview(consensusLevel, isTie, votes.length, config);

  return {
    topicId: votes[0]?.topicId || '',
    votes,
    totals,
    winner,
    consensusLevel,
    isTie,
    isUnanimous,
    requiresReview,
  };
}

function resolveVoteWeight(
  voterId: AIProvider,
  config: VotingConfig,
  providerConfigs: Record<AIProvider, AIProviderConfig>
): number {
  const baseWeight = providerConfigs[voterId]?.weight || 1.0;

  if (config.mode === 'expert-weighted' && config.expertProvider === voterId) {
    return baseWeight * 3;
  }

  return baseWeight;
}

/**
 * 处理平局
 */
function handleTie(
  winners: string[],
  tiebreaker: 'first' | 'random' | 'abstain'
): string | undefined {
  switch (tiebreaker) {
    case 'first':
      return winners[0];
    case 'random':
      return winners[Math.floor(Math.random() * winners.length)];
    case 'abstain':
      return undefined;  // 无获胜者
  }
}

/**
 * 计算共识程度
 * 返回 0-1 的值，1表示完全共识，0表示完全分裂
 */
function calculateConsensusLevel(
  totals: Record<string, number>,
  totalVotes: number,
  config: VotingConfig
): number {
  if (totalVotes === 0) return 0;

  const maxVotes = Math.max(...Object.values(totals));

  switch (config.mode) {
    case 'majority':
      // 多数模式：支持最高得票者的比例
      return maxVotes / totalVotes;

    case 'weighted':
    case 'expert-weighted':
      // 加权模式：已体现在totals中，直接计算比例
      return maxVotes / totalVotes;

    case 'consensus':
      // 共识模式：计算支持度超过阈值的选项比例
      const threshold = config.threshold;
      const aboveThreshold = Object.values(totals).filter(v => v / totalVotes >= threshold).length;
      return aboveThreshold > 0 ? maxVotes / totalVotes : 0;

    case 'unanimous':
      // 一致模式：只有所有人都同意才算共识
      return maxVotes === totalVotes ? 1 : maxVotes / totalVotes;

    default:
      return maxVotes / totalVotes;
  }
}

/**
 * 检查是否一致同意
 */
function checkUnanimity(votes: Vote[], winner: string | undefined): boolean {
  if (!winner) return false;
  return votes.every(v => v.choice === winner);
}

/**
 * 检查是否需要人工审查
 */
function checkIfRequiresReview(
  consensusLevel: number,
  isTie: boolean,
  totalVotes: number,
  config: VotingConfig
): boolean {
  // 平局总是需要审查
  if (isTie) return true;

  // 共识度低于阈值
  if (consensusLevel < config.threshold) return true;

  // 投票数太少（可能有些AI没响应）
  if (totalVotes < 2) return true;

  return false;
}

/**
 * 获取投票摘要
 */
export function getVotingSummary(result: VotingResult): {
  winner: string | undefined;
  margin: number;  // 获胜幅度
  participation: number;  // 参与率
  consensus: 'strong' | 'moderate' | 'weak' | 'none';
} {
  const sorted = Object.entries(result.totals).sort((a, b) => b[1] - a[1]);
  const winner = result.winner;
  const winnerVotes = winner ? result.totals[winner] : 0;
  const runnerUpVotes = sorted.length > 1 ? sorted[1][1] : 0;
  const totalVotes = Object.values(result.totals).reduce((sum, v) => sum + v, 0);

  const margin = totalVotes > 0 ? (winnerVotes - runnerUpVotes) / totalVotes : 0;

  let consensus: 'strong' | 'moderate' | 'weak' | 'none';
  if (result.consensusLevel >= 0.9) consensus = 'strong';
  else if (result.consensusLevel >= 0.7) consensus = 'moderate';
  else if (result.consensusLevel >= 0.5) consensus = 'weak';
  else consensus = 'none';

  return {
    winner,
    margin,
    participation: result.votes.length,
    consensus,
  };
}

/**
 * 格式化投票结果为可读文本
 */
export function formatVotingResult(result: VotingResult): string {
  const summary = getVotingSummary(result);

  let text = `投票结果:\n`;

  if (summary.winner) {
    text += `获胜者: ${summary.winner}\n`;
    text += `共识度: ${(result.consensusLevel * 100).toFixed(1)}%\n`;
    text += `共识强度: ${summary.consensus}\n`;
  } else {
    text += `结果: 平局（无明确获胜者）\n`;
  }

  text += `\n得票详情:\n`;
  Object.entries(result.totals)
    .sort((a, b) => b[1] - a[1])
    .forEach(([option, votes]) => {
      const percentage = result.votes.length > 0
        ? ((votes / result.votes.length) * 100).toFixed(1)
        : '0.0';
      text += `  ${option}: ${votes} 票 (${percentage}%)\n`;
    });

  if (result.requiresReview) {
    text += `\n⚠️ 需要人工审查\n`;
  }

  return text;
}
