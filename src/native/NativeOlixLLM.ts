/**
 * Raw NativeModules binding for the OlixLLM native module.
 *
 * Do not consume this directly — use LLMBridge instead, which provides
 * the clean onToken-callback interface and handles event subscriptions.
 */
import type {NativeModule} from 'react-native';
import {NativeEventEmitter, NativeModules, Platform} from 'react-native';

type NativeOlixLLMType = {
  loadModel(path: string): Promise<void>;
  /** Resolves when generation completes. Tokens arrive via NativeEventEmitter. */
  generateStream(prompt: string, imagePath?: string | null): Promise<void>;
  stopGeneration(): void;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
};

const {OlixLLM} = NativeModules as {OlixLLM: NativeOlixLLMType | undefined};

if (!OlixLLM) {
  const platform = Platform.OS;
  throw new Error(
    `OlixLLM native module is not available on ${platform}. ` +
      'Ensure the native build includes the OlixLLM module and pod install / gradle sync has run.',
  );
}

export const NativeOlixLLM: NativeOlixLLMType = OlixLLM;

// NativeEventEmitter on iOS needs a reference to the native module for
// addListener/removeListeners bookkeeping. On Android, passing undefined
// throws in newer RN versions — create without an argument instead.
export const OlixLLMEventEmitter =
  Platform.OS === 'ios'
    ? new NativeEventEmitter(OlixLLM as unknown as NativeModule)
    : new NativeEventEmitter();

export const LLM_EVENTS = {
  TOKEN: 'OlixLLM_token',
  DONE: 'OlixLLM_done',
  ERROR: 'OlixLLM_error',
} as const;
