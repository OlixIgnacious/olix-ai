import {NativeModules, DeviceEventEmitter} from 'react-native';
import type {EmitterSubscription} from 'react-native';

const {OlixSpeech} = NativeModules as {
  OlixSpeech: {
    startListening(): Promise<string>;
    stopListening(): void;
    addListener(eventName: string): void;
    removeListeners(count: number): void;
  };
};

export const SPEECH_EVENTS = {
  PARTIAL: 'OlixSpeech_partial',
  ERROR: 'OlixSpeech_error',
} as const;

export function startListening(): Promise<string> {
  return OlixSpeech.startListening();
}

export function stopListening(): void {
  OlixSpeech.stopListening();
}

export function onSpeechPartial(cb: (text: string) => void): EmitterSubscription {
  return DeviceEventEmitter.addListener(SPEECH_EVENTS.PARTIAL, (e: {text: string}) => cb(e.text));
}
