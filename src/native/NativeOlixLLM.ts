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
  generateStream(prompt: string): Promise<void>;
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
// addListener/removeListeners bookkeeping. On Android it's not required.
// OlixLLM satisfies NativeModule structurally — the explicit cast bridges
// our custom type to RN's internal interface.
export const OlixLLMEventEmitter = new NativeEventEmitter(
  Platform.OS === 'ios' ? (OlixLLM as unknown as NativeModule) : undefined,
);

export const LLM_EVENTS = {
  TOKEN: 'OlixLLM_token',
  DONE: 'OlixLLM_done',
  ERROR: 'OlixLLM_error',
} as const;
