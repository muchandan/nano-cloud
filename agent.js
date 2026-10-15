import fs from 'fs';
import path from 'path';
import { startAgent } from './src/agent/index.js';

// Zero-dependency .env loader
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of envConfig) {
    const match = line.match(/^([^#\s=]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  if (key) acc[key] = value || true;
  return acc;
}, {});

// Priority: 1. CLI flag (--relay=) 2. .env file (RELAY_URL=) 3. Default (localhost)
const RELAY_URL = args.relay || process.env.RELAY_URL || 'ws://localhost:8080';
const STORAGE_PATH = args.storage || process.env.STORAGE_PATH || './nanocloud_storage';

startAgent(RELAY_URL, STORAGE_PATH);

