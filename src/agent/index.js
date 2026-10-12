import { StorageManager } from './storage.js';
import { AgentClient } from './network.js';
import { getSystemMetrics, getMetadata } from './system/metrics.js';
import { loadCredentials, saveCredentials } from './credentials.js';
import { MSG_TYPES, ROLES } from '../shared/constants.js';

export async function startAgent(relayUrl, storagePath) {
  const storage = new StorageManager(storagePath);
  await storage.init();

  let powerMode = 'normal'; // 'normal' | 'eco'
  let telemetryTimer = null;
  let existingCreds = await loadCredentials();

  const metadata = getMetadata();

  const pushTelemetry = async (client) => {
    const metrics = await getSystemMetrics(powerMode);
    const storageStats = await storage.getStorageStats();
    client.send({ type: MSG_TYPES.TELEMETRY, ...metrics, storageStats });
  };

  const applyPowerProfile = (mode, client) => {
    powerMode = mode;
    if (telemetryTimer) {
      clearInterval(telemetryTimer);
      telemetryTimer = null;
    }

    if (powerMode === 'normal') {
      console.log('[Power] Normal Mode: Live telemetry active (2s loop).');
      pushTelemetry(client);
      telemetryTimer = setInterval(() => pushTelemetry(client), 2000);
    } else {
      console.log('[Power] Eco Standby: Polling suspended. Listening for commands.');
      // Send a single frame confirming standby state, then stop looping
      pushTelemetry(client);
    }
  };

  const handleMessage = async (data, client) => {
    // Ping/Pong RTT Echo (WebSocket loop latency)
    if (data.type === 'PING') {
      client.send({ type: 'PONG', clientTs: data.clientTs });
      return;
    }

    if (data.type === MSG_TYPES.ENROLL_PIN_ISSUED) {
      console.log('==================================================');
      console.log(` [NanoCloud] Host Unregistered`);
      console.log(` Claim PIN : ${data.pin}`);
      console.log(` Enter this PIN in your dashboard to pair this host.`);
      console.log('==================================================');
      return;
    }

    if (data.type === MSG_TYPES.ENROLL_SUCCESS) {
      console.log(`[Agent] Host paired as: ${data.deviceId}`);
      existingCreds = { deviceId: data.deviceId, deviceToken: data.deviceToken, pairedAt: new Date().toISOString() };
      await saveCredentials(existingCreds);
      applyPowerProfile('normal', client);
      return;
    }

    if (data.type === MSG_TYPES.AUTH_RES) {
      console.log(`[Agent] Authenticated as "${existingCreds?.deviceId}".`);
      applyPowerProfile('normal', client);
      return;
    }

    if (data.type === MSG_TYPES.CMD_SET_POWER) {
      applyPowerProfile(data.mode, client);
      client.send({ type: MSG_TYPES.CMD_ACK, action: 'power_mode', status: 'success', powerMode });
    }

    if (data.type === MSG_TYPES.CMD_KILL) {
      console.log('[Agent] Remote kill received. Terminating.');
      process.exit(0);
    }

    try {
      if (data.type === MSG_TYPES.CMD_LIST_FILES) {
        const files = await storage.listFiles();
        client.send({ type: MSG_TYPES.FILE_LIST, files });
      }

      if (data.type === MSG_TYPES.CMD_UPLOAD) {
        await storage.saveFile(data.fileName, data.fileData);
        client.send({ type: MSG_TYPES.CMD_ACK, action: 'upload', status: 'success', fileName: data.fileName });
        if (powerMode === 'normal') pushTelemetry(client);
      }

      if (data.type === MSG_TYPES.CMD_DOWNLOAD) {
        const base64Data = await storage.readFile(data.fileName);
        client.send({ type: MSG_TYPES.FILE_DATA, fileName: data.fileName, fileData: base64Data });
      }

      if (data.type === MSG_TYPES.CMD_DELETE) {
        await storage.deleteFile(data.fileName);
        client.send({ type: MSG_TYPES.CMD_ACK, action: 'delete', status: 'success' });
        if (powerMode === 'normal') pushTelemetry(client);
      }
    } catch (err) {
      console.error('[Agent] Storage operation error:', err.message);
    }
  };

  const client = new AgentClient(relayUrl, null, metadata, handleMessage);

  client.onOpen = () => {
    if (existingCreds?.deviceToken) {
      client.send({ type: MSG_TYPES.AUTH_REQ, role: ROLES.AGENT, deviceToken: existingCreds.deviceToken, metadata });
    } else {
      client.send({ type: MSG_TYPES.ENROLL_INIT, metadata });
    }
  };

  client.connect();
}

