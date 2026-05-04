import {NativeModules} from 'react-native';

const {OlixDownload} = NativeModules as {
  OlixDownload: {
    downloadModel(url: string, destPath: string): Promise<string>;
    cancelDownload(): Promise<void>;
    getFilesDir(): Promise<string>;
    extractTarBz2(tarPath: string, destDir: string): Promise<string>;
  };
};

export function downloadFile(url: string, destPath: string): Promise<string> {
  return OlixDownload.downloadModel(url, destPath);
}

export function cancelDownload(): Promise<void> {
  return OlixDownload.cancelDownload();
}

export function getFilesDir(): Promise<string> {
  return OlixDownload.getFilesDir();
}

export function extractTarBz2(tarPath: string, destDir: string): Promise<string> {
  return OlixDownload.extractTarBz2(tarPath, destDir);
}
