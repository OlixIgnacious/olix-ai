import {NativeModules} from 'react-native';

const {OlixDocument} = NativeModules as {
  OlixDocument: {extractPdfText: (filePath: string) => Promise<string>};
};

export function extractPdfText(filePath: string): Promise<string> {
  return OlixDocument.extractPdfText(filePath);
}
