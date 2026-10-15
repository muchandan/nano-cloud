import fs from 'fs';
import path from 'path';
import os from 'os';
import { startRelayServer } from './src/relay/index.js';

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

const PORT = process.env.PORT || 8080;
const SECRET_TOKEN = process.env.SECRET_TOKEN;

if (!SECRET_TOKEN) {
  console.error('❌ FATAL ERROR: SECRET_TOKEN is missing. Define it in .env.');
  process.exit(1);
}

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

startRelayServer(PORT, SECRET_TOKEN).then(() => {
  const localIp = getLocalIp();
  console.log(`\n================================================`);
  console.log(` 🚀 NanoCloud Relay Server Active`);
  console.log(`================================================`);
  console.log(` To connect an agent on THIS same device:`);
  console.log(` -> node agent.js`);
  if (localIp) {
    console.log(`\n To connect agents on OTHER devices on Wi-Fi:`);
    console.log(` -> node agent.js --relay=ws://${localIp}:${PORT}`);
  }
  console.log(`================================================\n`);
});

