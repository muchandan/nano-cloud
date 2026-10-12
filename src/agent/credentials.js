import fs from 'fs/promises';
import path from 'path';

const CREDENTIALS_FILE = path.resolve('./nanocloud_credentials.json');

export async function loadCredentials() {
  try {
    const raw = await fs.readFile(CREDENTIALS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveCredentials(credentials) {
  await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), 'utf8');
  console.log(`[Credentials] Saved permanent pairing token to ${CREDENTIALS_FILE}`);
}
