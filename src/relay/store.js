import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class FleetStore {
  constructor(filePath = './nanocloud_fleet.json') {
    this.filePath = path.resolve(filePath);
    this.devices = new Map(); // token -> { id, name, platform, pairedAt }
    this.pendingPins = new Map(); // pin -> { ws, metadata, expiresAt }
  }

  async init() {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(data);
      for (const [token, info] of Object.entries(parsed.devices || {})) {
        this.devices.set(token, info);
      }
      console.log(`[Store] Loaded ${this.devices.size} registered devices from database.`);
    } catch {
      console.log('[Store] No existing fleet database found. Initializing fresh store.');
      await this._save();
    }
  }

  async _save() {
    const payload = { devices: Object.fromEntries(this.devices.entries()) };
    await fs.writeFile(this.filePath, JSON.stringify(payload, null, 2));
  }

  // Generates a human-friendly 6-digit PIN (e.g. 482-901)
  generateClaimPin(ws, metadata) {
    const rawPin = `${crypto.randomInt(100, 999)}-${crypto.randomInt(100, 999)}`;
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    this.pendingPins.set(rawPin, { ws, metadata, expiresAt });

    // Clean up expired PINs
    setTimeout(() => {
      if (this.pendingPins.has(rawPin) && this.pendingPins.get(rawPin).expiresAt <= Date.now()) {
        this.pendingPins.delete(rawPin);
      }
    }, 10 * 60 * 1000);

    return rawPin;
  }

  // Verifies a PIN entered from the dashboard and pairs the host
  async claimDeviceByPin(pin, customName) {
    const entry = this.pendingPins.get(pin);
    if (!entry) {
      return { success: false, reason: 'Invalid or expired claim PIN.' };
    }

    if (Date.now() > entry.expiresAt) {
      this.pendingPins.delete(pin);
      return { success: false, reason: 'PIN has expired. Restart agent to generate a new one.' };
    }

    // Generate permanent cryptographic token
    const deviceToken = `dev_${crypto.randomBytes(24).toString('hex')}`;
    const deviceId = customName || entry.metadata.hostname || `Node-${pin.replace('-', '')}`;

    const deviceRecord = {
      id: deviceId,
      platform: entry.metadata.platform,
      arch: entry.metadata.arch,
      cores: entry.metadata.cores,
      pairedAt: new Date().toISOString()
    };

    this.devices.set(deviceToken, deviceRecord);
    this.pendingPins.delete(pin);
    await this._save();

    return {
      success: true,
      deviceToken,
      deviceId,
      pendingWs: entry.ws,
      metadata: entry.metadata
    };
  }

  validateDeviceToken(token) {
    return this.devices.get(token) || null;
  }
}
