/**
 * LLMBridge — clean TypeScript interface to the on-device LLM.
 *
 * Matches the native bridge contract:
 *   loadModel(path)                         → Promise<void>
 *   generateStream(prompt, onToken)         → Promise<void>  (resolves when done)
 *   stopGeneration()                        → void
 *
 * This module owns event subscription lifecycle. Callers only see callbacks.
 */
import {DeviceEventEmitter} from 'react-native';
import {NativeOlixLLM, LLM_EVENTS} from './NativeOlixLLM';
import {logger} from '@/utils/logger';

// ─── Active listener cleanup ──────────────────────────────────────────────────

// Tracks the cleanup fn for the currently in-flight generateStream call.
// stopGeneration() must call this to prevent zombie listeners accumulating
// across successive generations, which causes every token to fire N times.
let activeCleanup: (() => void) | null = null;

// ─── Public interface ─────────────────────────────────────────────────────────

/**
 * Loads the Gemma model from an absolute file path.
 * Must be called once before generateStream.
 * Resolves when the model is fully loaded into memory (~2–5 s on modern hardware).
 */
export function loadModel(path: string): Promise<void> {
  logger.debug('LLMBridge.loadModel', {path});
  return NativeOlixLLM.loadModel(path);
}

/**
 * Streams a response for the given prompt.
 *
 * `onToken` is called synchronously-from-JS-perspective for each incremental
 * token. The returned Promise resolves when generation finishes naturally or
 * rejects if a native error occurs.
 *
 * Call `stopGeneration()` to abort early — the Promise will never resolve or
 * reject after that point; callers must handle that case (e.g. via a race).
 */
export function generateStream(
  prompt: string,
  onToken: (token: string) => void,
  imagePath?: string | null,
): Promise<void> {
  logger.debug('LLMBridge.generateStream', {promptLength: prompt.length, hasImage: !!imagePath});

  // Remove any zombie listeners from a previously stopped generation.
  activeCleanup?.();
  activeCleanup = null;

  return new Promise<void>((resolve, reject) => {
    const tokenSub = DeviceEventEmitter.addListener(LLM_EVENTS.TOKEN, (event: {token: string}) => {
      logger.debug('LLMBridge: token received', {token: event?.token});
      onToken(event.token);
    });

    const doneSub = DeviceEventEmitter.addListener(LLM_EVENTS.DONE, () => {
      logger.debug('LLMBridge: done received');
      cleanup();
      resolve();
    });

    const errorSub = DeviceEventEmitter.addListener(LLM_EVENTS.ERROR, (event: {error: string}) => {
      cleanup();
      reject(new Error(event.error));
    });

    function cleanup(): void {
      tokenSub.remove();
      doneSub.remove();
      errorSub.remove();
      activeCleanup = null;
    }

    activeCleanup = cleanup;

    // The native promise drives generation; events carry the tokens.
    // We ignore the native promise's resolve here because we resolve via DONE event.
    NativeOlixLLM.generateStream(prompt, imagePath ?? null).catch((err: unknown) => {
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

/**
 * Suppresses further token events from the active generation.
 * The underlying native session runs to completion; no further events fire.
 * Any in-flight generateStream Promise will never settle after this call.
 */
export function stopGeneration(): void {
  logger.debug('LLMBridge.stopGeneration');
  // Remove zombie listeners before the native side is told to stop, so no
  // residual token/done/error events can fire into a stale callback.
  activeCleanup?.();
  activeCleanup = null;
  NativeOlixLLM.stopGeneration();
}
