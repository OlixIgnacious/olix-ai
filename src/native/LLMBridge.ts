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
import {NativeOlixLLM, OlixLLMEventEmitter, LLM_EVENTS} from './NativeOlixLLM';
import {logger} from '@/utils/logger';

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
export function generateStream(prompt: string, onToken: (token: string) => void): Promise<void> {
  logger.debug('LLMBridge.generateStream', {promptLength: prompt.length});

  return new Promise<void>((resolve, reject) => {
    const tokenSub = OlixLLMEventEmitter.addListener(LLM_EVENTS.TOKEN, (event: {token: string}) => {
      onToken(event.token);
    });

    const doneSub = OlixLLMEventEmitter.addListener(LLM_EVENTS.DONE, () => {
      cleanup();
      resolve();
    });

    const errorSub = OlixLLMEventEmitter.addListener(LLM_EVENTS.ERROR, (event: {error: string}) => {
      cleanup();
      reject(new Error(event.error));
    });

    function cleanup(): void {
      tokenSub.remove();
      doneSub.remove();
      errorSub.remove();
    }

    // The native promise drives generation; events carry the tokens.
    // We ignore the native promise's resolve here because we resolve via DONE event.
    NativeOlixLLM.generateStream(prompt).catch((err: unknown) => {
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
  NativeOlixLLM.stopGeneration();
}
