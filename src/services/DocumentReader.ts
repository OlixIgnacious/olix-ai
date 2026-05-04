import {pick, types, isCancel} from 'react-native-document-picker';
import RNFetchBlob from 'rn-fetch-blob';
import {extractPdfText} from '@/native/NativeOlixDocument';

// ~3,000 words — keeps the full doc comfortably inside Gemma 4's 8k token context.
const MAX_CHARS = 12_000;

export type PickedDocument = {
  name: string;
  content: string;
  truncated: boolean;
};

/**
 * Opens the system file picker, reads the chosen file, and returns its text
 * content. Returns null if the user cancels.
 *
 * Supported formats: PDF (via pdfbox-android native module), and plain-text
 * formats (.txt, .md, .csv, .json) read directly via rn-fetch-blob.
 */
export async function pickAndReadDocument(): Promise<PickedDocument | null> {
  let files;
  try {
    files = await pick({
      type: [types.pdf, types.plainText, types.csv],
      // copyTo ensures we get a file:// URI readable from native code.
      copyTo: 'cachesDirectory',
    });
  } catch (err) {
    if (isCancel(err)) {
      return null;
    }
    throw err;
  }

  const file = files[0];
  if (!file) {
    return null;
  }

  const uri = (file.fileCopyUri ?? file.uri).replace(/^file:\/\//, '');
  const name = file.name ?? 'Document';
  const mimeType = file.type ?? '';

  let text: string;
  if (mimeType === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) {
    text = await extractPdfText(uri);
  } else {
    text = await RNFetchBlob.fs.readFile(uri, 'utf8');
  }

  const truncated = text.length > MAX_CHARS;
  return {
    name,
    content: truncated ? text.slice(0, MAX_CHARS) : text,
    truncated,
  };
}
