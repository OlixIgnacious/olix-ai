import {pick, types, isCancel} from 'react-native-document-picker';

export type PickedImage = {
  name: string;
  uri: string; // file:// URI suitable for display and native bitmap decode
};

/**
 * Opens the system file picker filtered to images.
 * Returns the chosen image's name and file URI, or null if the user cancelled.
 *
 * The file is copied to the app's cache directory so the native bitmap decoder
 * receives a stable file:// path rather than a content:// URI.
 */
export async function pickImage(): Promise<PickedImage | null> {
  let files;
  try {
    files = await pick({
      type: [types.images],
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

  const uri = file.fileCopyUri ?? file.uri;
  const name = file.name ?? 'Image';

  return {name, uri};
}
