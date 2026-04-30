import { describe, it, expect } from 'vitest';
import { parseChallengeResponse } from '../parser';

const opts = { challengerId: 'a', targetId: 'b', threshold: 0.7 };

describe('parseChallengeResponse', () => {
  it('parses a clean fenced JSON response', () => {
    const r = parseChallengeResponse(
      '```json\n{"challenges":[{"type":"factual-error","severity":"high","targetSegment":"x","reason":"y","confidence":0.9}]}\n```',
      opts
    );
    expect(r.error).toBeUndefined();
    expect(r.challenges).toHaveLength(1);
    expect(r.challenges[0].type).toBe('factual-error');
  });

  it('extracts the first balanced JSON object when the model echoes the prompt example first', () => {
    // Model echoes the prompt's example `{...}` then emits the real answer.
    // A greedy /\{[\s\S]*\}/ would glue both into one unparseable blob.
    const response = `Sure, the format is like {"challenges": [...]} with these fields. Here's my answer:\n\n{"challenges":[{"type":"omission","severity":"medium","targetSegment":"foo","reason":"missed point","confidence":0.85}]}`;
    const r = parseChallengeResponse(response, opts);
    expect(r.error).toBeUndefined();
    expect(r.challenges).toHaveLength(1);
    expect(r.challenges[0].type).toBe('omission');
  });

  it('does not get confused by braces inside string literals', () => {
    const response = `{"challenges":[{"type":"unclear","severity":"low","targetSegment":"contains } brace","reason":"weird {","confidence":0.8}]}`;
    const r = parseChallengeResponse(response, opts);
    expect(r.error).toBeUndefined();
    expect(r.challenges).toHaveLength(1);
  });

  it('drops challenges below the confidence threshold', () => {
    const r = parseChallengeResponse(
      '{"challenges":[{"type":"factual-error","severity":"high","targetSegment":"x","reason":"y","confidence":0.5}]}',
      opts
    );
    expect(r.challenges).toHaveLength(0);
  });

  it('rejects invalid type and severity enums', () => {
    const r = parseChallengeResponse(
      '{"challenges":[{"type":"made-up","severity":"super","targetSegment":"x","reason":"y","confidence":0.9}]}',
      opts
    );
    expect(r.challenges).toHaveLength(0);
  });

  it('returns an error when no JSON object is found', () => {
    const r = parseChallengeResponse('I refuse to answer.', opts);
    expect(r.challenges).toHaveLength(0);
    expect(r.error).toMatch(/No JSON object/);
  });

  it('returns an error when JSON is malformed', () => {
    const r = parseChallengeResponse('{"challenges": [oops}', opts);
    expect(r.challenges).toHaveLength(0);
    expect(r.error).toMatch(/JSON parse error/);
  });

  it('returns an error when challenges is missing or wrong type', () => {
    const r = parseChallengeResponse('{"foo": "bar"}', opts);
    expect(r.error).toMatch(/Missing or invalid challenges/);
  });
});
