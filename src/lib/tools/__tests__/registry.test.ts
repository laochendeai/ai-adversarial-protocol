import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../registry';
import { ToolDefinition } from '../types';

const echoDef: ToolDefinition = {
  name: 'echo',
  description: 'returns its input',
  parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
};

const ctx = { modelId: 'm', runId: 'r' } as const;

describe('ToolRegistry', () => {
  it('registers and dispatches', async () => {
    const r = new ToolRegistry();
    r.register(echoDef, async args => ({
      id: '',
      ok: true,
      content: (args as { text: string }).text,
    }));
    const result = await r.dispatch({ id: 'c1', name: 'echo', args: { text: 'hi' } }, ctx);
    expect(result).toEqual({ id: 'c1', ok: true, content: 'hi' });
  });

  it('returns ok:false on unknown tool', async () => {
    const r = new ToolRegistry();
    const result = await r.dispatch({ id: 'c2', name: 'nope', args: {} }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/unknown tool/);
  });

  it('catches handler exceptions', async () => {
    const r = new ToolRegistry();
    r.register(echoDef, async () => {
      throw new Error('boom');
    });
    const result = await r.dispatch({ id: 'c3', name: 'echo', args: { text: 'x' } }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('boom');
  });

  it('rejects duplicate registration', () => {
    const r = new ToolRegistry();
    r.register(echoDef, async () => ({ id: '', ok: true, content: '' }));
    expect(() =>
      r.register(echoDef, async () => ({ id: '', ok: true, content: '' }))
    ).toThrow(/already registered/);
  });

  it('list() returns all definitions including hidden', () => {
    const r = new ToolRegistry();
    r.register(echoDef, async () => ({ id: '', ok: true, content: '' }));
    r.register(
      { name: 'concede', description: 'admit error', parameters: {}, hidden: true },
      async () => ({ id: '', ok: true, content: 'noted' })
    );
    expect(r.list().map(d => d.name)).toEqual(['echo', 'concede']);
  });

  it('overwrites id from handler with the call id', async () => {
    const r = new ToolRegistry();
    r.register(echoDef, async () => ({ id: 'wrong', ok: true, content: 'x' }));
    const result = await r.dispatch({ id: 'real', name: 'echo', args: {} }, ctx);
    expect(result.id).toBe('real');
  });
});
