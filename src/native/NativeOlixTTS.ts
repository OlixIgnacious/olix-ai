import {NativeModules} from 'react-native';

const {OlixTTS} = NativeModules as {
  OlixTTS: {
    initialize(modelDir: string): Promise<void>;
    speak(text: string): Promise<void>;
    stop(): void;
  };
};

export function initializeTTS(modelDir: string): Promise<void> {
  return OlixTTS.initialize(modelDir);
}

export function speak(text: string): Promise<void> {
  return OlixTTS.speak(text);
}

export function stopSpeaking(): void {
  OlixTTS.stop();
}
