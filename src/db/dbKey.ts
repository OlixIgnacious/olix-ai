import 'react-native-get-random-values';
import * as Keychain from 'react-native-keychain';

const SERVICE = 'com.olix.db.key';
const USERNAME = 'db-encryption-key';

function generateKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Returns the DB encryption key from Android Keystore, generating and
 * persisting a new one on first call. The key never leaves the device.
 */
export async function getOrCreateDbKey(): Promise<string> {
  const existing = await Keychain.getGenericPassword({service: SERVICE});
  if (existing) {
    return existing.password;
  }
  const key = generateKey();
  await Keychain.setGenericPassword(USERNAME, key, {service: SERVICE});
  return key;
}
