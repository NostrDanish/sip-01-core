/**
 * AI credential precedence tests — the exact chain:
 *
 *   user key → engine-provided proxy → built-in free tier → AI unavailable
 *
 * plus the secrecy invariant: the engine tier never puts any key in the
 * client-side resolved config (the built-in tier's shared key is public
 * and rate-limited BY DESIGN — a different, disclosed tradeoff).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  resolveAIConfig,
  engineAIAvailable,
  hasOwnAIKey,
  getDefaultAIConfig,
  ENGINE_AI_BASE,
  type EngineAIStatus,
} from './aiConfig';
import { configureEngine, resetEngineConfig, type EngineRuntimeConfig } from '@/lib/engineConfig';

/**
 * Test-local host profile fixture — the values the deleted Dsearch app
 * profile (src/app/profile.ts) used to inject through configureEngine(),
 * copied verbatim so the precedence semantics below are unchanged. The
 * community tier's shared key is public BY DESIGN (rate-limited; it used to
 * ship in the app's bundle).
 */
const TEST_ENGINE_PROFILE: EngineRuntimeConfig = {
  id: 'dsearch',
  search: {
    brave: true,
    indexerSource: 'dsearch-web/1',
  },
  ai: {
    enabledDefault: false,
    providerId: 'ppq',
    providerName: 'PPQ.ai',
    endpoint: 'https://api.ppq.ai/v1',
    model: 'auto',
    systemPrompt: 'You are the Dsearch answer engine — a synthesis layer over a decentralized search network.',
    community: {
      providerId: 'ppq',
      endpoint: 'https://api.ppq.ai/v1',
      apiKey: 'sk-VPVVNlf79DvGjUfjjrHeFT',
      model: 'qwen/qwen-2.5-7b-instruct',
    },
  },
};

/** The host profile carries the community free tier (its public key). */
const COMMUNITY = TEST_ENGINE_PROFILE.ai.community!;

/** Mirror a host's bootstrap: the host injects its profile at startup. */
function configureTestEngine(): void {
  configureEngine(TEST_ENGINE_PROFILE);
}

const ENGINE_ON: EngineAIStatus = {
  configured: true,
  enabled: true,
  providerName: 'PPQ.ai',
  endpoint: 'https://api.ppq.ai/v1',
  model: 'qwen/qwen-2.5-7b-instruct',
  keyTail: 'cdef',
};

const ENGINE_OFF: EngineAIStatus = { configured: false, enabled: false };

describe('resolveAIConfig precedence (configured host)', () => {
  beforeEach(configureTestEngine);
  afterEach(resetEngineConfig);

  it('1. no engine + no user key → built-in free tier (locked provider+model)', () => {
    const r = resolveAIConfig({ ...getDefaultAIConfig(), apiKey: '' }, ENGINE_OFF);
    expect(r.tier).toBe('community');
    expect(r.apiKey).toBe(COMMUNITY.apiKey); // public by design (rate-limited)
    expect(r.model).toBe(COMMUNITY.model); // locked — user's 'auto' ignored
    expect(r.endpoint).toBe(COMMUNITY.endpoint);
  });

  it('1b. static deploy (no status endpoint) still gets the built-in tier', () => {
    const r = resolveAIConfig({ ...getDefaultAIConfig(), apiKey: '' }, null);
    expect(r.tier).toBe('community');
  });

  it('2. engine configured only → engine tier beats the built-in tier', () => {
    const r = resolveAIConfig({ ...getDefaultAIConfig(), apiKey: '' }, ENGINE_ON);
    expect(r.tier).toBe('engine');
    expect(r.endpoint).toBe(ENGINE_AI_BASE); // same-origin /api/ai
    expect(r.model).toBe('qwen/qwen-2.5-7b-instruct');
    expect(r.engine?.providerName).toBe('PPQ.ai');
  });

  it('3. user key only → user tier with their provider/endpoint/model', () => {
    const r = resolveAIConfig(
      { ...getDefaultAIConfig(), providerId: 'openrouter', endpoint: 'https://openrouter.ai/api/v1', apiKey: 'sk-user-own-key', model: 'auto' },
      ENGINE_OFF,
    );
    expect(r.tier).toBe('user');
    expect(r.apiKey).toBe('sk-user-own-key');
    expect(r.providerId).toBe('openrouter');
  });

  it('4. all configured → user key takes precedence over engine + built-in', () => {
    const r = resolveAIConfig({ ...getDefaultAIConfig(), apiKey: 'sk-user-own-key' }, ENGINE_ON);
    expect(r.tier).toBe('user');
    expect(r.apiKey).toBe('sk-user-own-key');
  });

  it('host profile without a community tier → AI unavailable (no baked-in key)', () => {
    // The generic layer holds no credentials: a host that injects a profile
    // without `ai.community` gets no community tier.
    const { community: _community, ...aiNoCommunity } = TEST_ENGINE_PROFILE.ai;
    configureEngine({ ...TEST_ENGINE_PROFILE, ai: aiNoCommunity });
    const r = resolveAIConfig({ ...getDefaultAIConfig(), apiKey: '' }, ENGINE_OFF);
    expect(r.tier).toBe('unavailable');
    expect(r.apiKey).toBe('');
  });

  it('7. engine disabled by operator → falls through to the built-in tier', () => {
    const r = resolveAIConfig(
      { ...getDefaultAIConfig(), apiKey: '' },
      { ...ENGINE_ON, enabled: false },
    );
    expect(r.tier).toBe('community');
  });

  it('keyless provider selection (Ollama) beats engine + built-in tiers', () => {
    const r = resolveAIConfig(
      { ...getDefaultAIConfig(), providerId: 'ollama', endpoint: 'http://localhost:11434/v1', apiKey: '' },
      ENGINE_ON,
    );
    expect(r.tier).toBe('keyless');
    expect(r.endpoint).toBe('http://localhost:11434/v1');
  });
});

describe('unconfigured engine (neutral defaults)', () => {
  afterEach(resetEngineConfig);

  it('no host profile → keyless custom provider, never a baked-in tier', () => {
    // Without configureEngine() the engine is brand-free: providerId
    // 'custom' (requiresKey: false) resolves to the keyless tier, and the
    // host's community/engine tiers only appear once a profile is injected.
    const r = resolveAIConfig({ ...getDefaultAIConfig(), apiKey: '' }, ENGINE_ON);
    expect(r.tier).toBe('keyless');

    configureTestEngine();
    const hosted = resolveAIConfig({ ...getDefaultAIConfig(), apiKey: '' }, ENGINE_ON);
    expect(hosted.tier).toBe('engine');
  });
});

describe('secrecy invariants', () => {
  beforeEach(configureTestEngine);
  afterEach(resetEngineConfig);

  it('5/6. the engine tier never puts any key into client config', () => {
    const r = resolveAIConfig({ ...getDefaultAIConfig(), apiKey: '' }, ENGINE_ON);
    expect(r.apiKey).toBe('');
    // The masked tail is display metadata, not credential material.
    expect(JSON.stringify(r)).not.toContain('sk-');
  });

  it('hasOwnAIKey: whitespace is not a key', () => {
    expect(hasOwnAIKey({ ...getDefaultAIConfig(), apiKey: '   ' })).toBe(false);
    expect(hasOwnAIKey({ ...getDefaultAIConfig(), apiKey: 'sk-x' })).toBe(true);
  });

  it('engineAIAvailable requires configured AND enabled', () => {
    expect(engineAIAvailable(ENGINE_ON)).toBe(true);
    expect(engineAIAvailable(ENGINE_OFF)).toBe(false);
    expect(engineAIAvailable({ configured: true, enabled: false })).toBe(false);
    expect(engineAIAvailable(null)).toBe(false);
    expect(engineAIAvailable(undefined)).toBe(false);
  });
});
