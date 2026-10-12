import fs from 'fs';
import path from 'path';
import { startRelayServer } from './src/relay/index.js';

// Zero-dependency .env loader for local development
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of envConfig) {
    const match = line.match(/^([^#\s=]+)=(.*)$/);
    if (match) {
      // Only set if not already provided by the OS/Host (like Render)
      if (!process.env[match[1]]) {
        process.env[match[1]] = match[2].trim();
      }
    }
  }
  console.log('Loaded environment variables from .env');
}

const PORT = process.env.PORT || 8080;
const SECRET_TOKEN = process.env.SECRET_TOKEN;

if (!SECRET_TOKEN) {
  console.error('FATAL ERROR: SECRET_TOKEN is missing. Define it in .env or your cloud host.');
  process.exit(1);
}

startRelayServer(PORT, SECRET_TOKEN);

