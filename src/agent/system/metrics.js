
import os from 'os';
import { getOsCpuLoad, getOsMemory } from './platform-os.js';
import { getEluCpuLoad } from './platform-ext.js';
import { getBatteryStatus, getThermalStatus } from './sensors.js';

export async function getSystemMetrics(powerMode) {
  let cpuLoad = 0;
  try {
    const osCpu = getOsCpuLoad();
    cpuLoad = osCpu !== null ? osCpu : getEluCpuLoad();
  } catch {
    cpuLoad = getEluCpuLoad();
  }

  let mem = { used: '0.00', total: '0.00' };
  try {
    mem = getOsMemory() || mem;
  } catch {}

  const [battery, thermal] = await Promise.all([
    getBatteryStatus(),
    getThermalStatus()
  ]);

  return {
    cpuLoad,
    ramUsed: mem.used,
    ramTotal: mem.total,
    battery,
    thermal,
    uptime: process.uptime(),
    powerMode // 'normal' | 'eco'
  };
}

export function getMetadata() {
  let cores = 1;
  try { cores = os.cpus().length || 1; } catch {}

  return {
    platform: os.platform(),
    arch: os.arch(),
    cores,
    hostname: os.hostname() || 'Nano-Node'
  };
}

