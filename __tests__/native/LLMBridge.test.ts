/**
 * Unit tests for LLMBridge.
 *
 * NativeOlixLLM is mocked directly so we control both the native module
 * and the event emitter. The mock factory is self-contained (no external
 * variable references) and exposes __fireEvent / __clearListeners helpers.
 */

// ─── Mock ─────────────────────────────────────────────────────────────────────

jest.mock('../../src/native/NativeOlixLLM', () => {
  // Listener store lives entirely inside the factory — no external refs.
  const store: Record<string, Array<(p: unknown) => void>> = {};

  return {
    NativeOlixLLM: {
      loadModel: jest.fn(),
      generateStream: jest.fn(),
      stopGeneration: jest.fn(),
    },
    OlixLLMEventEmitter: {
      addListener: jest.fn((event: string, cb: (p: unknown) => void) => {
        store[event] = store[event] ?? [];
        store[event].push(cb);
        return {
          remove: jest.fn(() => {
            store[event] = (store[event] ?? []).filter(l => l !== cb);
          }),
        };
      }),
    },
    LLM_EVENTS: {TOKEN: 'OlixLLM_token', DONE: 'OlixLLM_done', ERROR: 'OlixLLM_error'},
    // Test helpers — access via (require('...') as MockedModule).__fireEvent
    __fireEvent: (event: string, payload: unknown) =>
      (store[event] ?? []).forEach(cb => cb(payload)),
    __clearListeners: () =>
      Object.keys(store).forEach(k => {
        delete store[k];
      }),
  };
});

jest.mock('react-native-config', () => ({
  APP_ENV: 'dev',
  APP_DISPLAY_NAME: 'Olix Dev',
  BUNDLE_ID: 'com.olix.dev',
  MODEL_CDN_URL: 'https://dev-cdn.example.com/models',
  SENTRY_DSN: '',
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import {NativeOlixLLM} from '../../src/native/NativeOlixLLM';
import {loadModel, generateStream, stopGeneration} from '../../src/native/LLMBridge';

// Typed handle to the mock factory's test helpers
const {__fireEvent, __clearListeners} = jest.requireMock<{
  __fireEvent(event: string, payload: unknown): void;
  __clearListeners(): void;
}>('../../src/native/NativeOlixLLM');

// jest.mocked() preserves the original type and adds jest.Mock methods without `any`
const mockLoadModel = jest.mocked(NativeOlixLLM.loadModel);
const mockGenerateStream = jest.mocked(NativeOlixLLM.generateStream);
const mockStopGeneration = jest.mocked(NativeOlixLLM.stopGeneration);

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  __clearListeners();
});

// ── loadModel ─────────────────────────────────────────────────────────────────

describe('loadModel', () => {
  it('delegates to NativeOlixLLM.loadModel with the given path', async () => {
    mockLoadModel.mockResolvedValueOnce(undefined);
    await loadModel('/models/gemma.task');
    expect(mockLoadModel).toHaveBeenCalledWith('/models/gemma.task');
  });

  it('propagates native rejection', async () => {
    mockLoadModel.mockRejectedValueOnce(new Error('file not found'));
    await expect(loadModel('/bad/path')).rejects.toThrow('file not found');
  });
});

// ── generateStream ────────────────────────────────────────────────────────────

describe('generateStream', () => {
  it('resolves and calls onToken for each token when DONE fires', async () => {
    // Native generateStream never settles — resolution comes from the DONE event
    mockGenerateStream.mockReturnValueOnce(new Promise(() => {}));

    const tokens: string[] = [];
    const promise = generateStream('Hello', t => tokens.push(t));

    __fireEvent('OlixLLM_token', {token: 'Hi'});
    __fireEvent('OlixLLM_token', {token: ' there'});
    __fireEvent('OlixLLM_done', {});

    await expect(promise).resolves.toBeUndefined();
    expect(tokens).toEqual(['Hi', ' there']);
  });

  it('rejects when ERROR event fires', async () => {
    mockGenerateStream.mockReturnValueOnce(new Promise(() => {}));

    const promise = generateStream('Hello', jest.fn());
    __fireEvent('OlixLLM_error', {error: 'OOM during generation'});

    await expect(promise).rejects.toThrow('OOM during generation');
  });

  it('rejects when native generateStream promise rejects', async () => {
    mockGenerateStream.mockRejectedValueOnce(new Error('native crash'));

    await expect(generateStream('Hello', jest.fn())).rejects.toThrow('native crash');
  });

  it('removes all subscriptions after DONE', async () => {
    mockGenerateStream.mockReturnValueOnce(new Promise(() => {}));

    const onToken = jest.fn();
    const promise = generateStream('Hello', onToken);
    __fireEvent('OlixLLM_done', {});
    await promise;

    // Firing events after cleanup should not reach onToken
    __fireEvent('OlixLLM_token', {token: 'ghost'});
    expect(onToken).not.toHaveBeenCalled();
  });

  it('removes all subscriptions after ERROR', async () => {
    mockGenerateStream.mockReturnValueOnce(new Promise(() => {}));

    const onToken = jest.fn();
    const promise = generateStream('Hello', onToken);
    __fireEvent('OlixLLM_error', {error: 'fail'});
    await expect(promise).rejects.toThrow();

    __fireEvent('OlixLLM_token', {token: 'ghost'});
    expect(onToken).not.toHaveBeenCalled();
  });

  it('passes the prompt to native generateStream', () => {
    mockGenerateStream.mockReturnValueOnce(new Promise(() => {}));
    void generateStream('What is 2+2?', jest.fn());
    expect(mockGenerateStream).toHaveBeenCalledWith('What is 2+2?');
  });
});

// ── stopGeneration ────────────────────────────────────────────────────────────

describe('stopGeneration', () => {
  it('delegates to NativeOlixLLM.stopGeneration', () => {
    stopGeneration();
    expect(mockStopGeneration).toHaveBeenCalledTimes(1);
  });
});
