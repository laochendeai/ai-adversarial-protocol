/**
 * Demo: 直接驱动 EngineHub 运行一次对抗，输出事件流
 * 用法：tsx src/scripts/demo-engine.ts
 *
 * 需要先在 ~/.aap/config.json 配置至少 2 个 enabled 模型。
 */

import { loadConfig } from '@/config/loader';
import { EngineHub } from '@/engine/EngineHub';
import { EngineEvent, ChunkEventData } from '@/lib/types';

async function main() {
  const config = loadConfig();
  if (config.models.filter(m => m.enabled).length < 2) {
    console.error('Need at least 2 enabled models in ~/.aap/config.json');
    process.exit(1);
  }

  const hub = new EngineHub(config);
  hub.on('engine-event', (event: EngineEvent) => {
    if (event.type === 'chunk') {
      const data = event.data as ChunkEventData;
      process.stdout.write(`[${data.modelId}] ${data.delta}`);
    } else if (event.type === 'phase-change') {
      console.log(`\n>>> phase: ${(event.data as { phase: string }).phase}`);
    } else if (event.type === 'challenge') {
      console.log('\n>>> challenge:', event.data);
    } else if (event.type === 'voting-result') {
      console.log('\n>>> voting-result:', event.data);
    } else if (event.type === 'run-complete') {
      console.log('\n>>> run-complete');
    } else if (event.type === 'run-failed') {
      console.log('\n>>> run-failed:', event.data);
    }
  });

  const { promise } = hub.startRun({
    question: '简单介绍一下 Rust 的所有权机制（200 字以内）',
    modelIds: [],
    source: 'tui-input',
  });

  const result = await promise;
  console.log('\n\nResult durations:', result.responses.map(r => `${r.modelId}: ${r.durationMs}ms`));
  console.log('Voting winner:', result.voting?.winner ?? '(none)');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
