import fs from 'fs/promises';

// Reads hardware battery capacity and charging state (Android & Linux)
export async function getBatteryStatus() {
  try {
    const basePath = '/sys/class/power_supply/battery';
    const capacityRaw = await fs.readFile(`${basePath}/capacity`, 'utf8');
    const statusRaw = await fs.readFile(`${basePath}/status`, 'utf8').catch(() => 'Discharging');

    return {
      percentage: parseInt(capacityRaw.trim(), 10),
      isCharging: statusRaw.trim().toLowerCase() === 'charging'
    };
  } catch {
    return null; // Hardware not present or permission restricted
  }
}

// Reads primary CPU thermal zone in °C
export async function getThermalStatus() {
  try {
    // Check primary thermal zone
    const tempRaw = await fs.readFile('/sys/class/thermal/thermal_zone0/temp', 'utf8');
    let temp = parseInt(tempRaw.trim(), 10);
    
    // Kernel values are typically millidegrees Celsius (e.g. 42000 = 42°C)
    if (temp > 1000) temp = Math.round(temp / 1000);
    
    return temp > 0 && temp < 120 ? temp : null;
  } catch {
    return null;
  }
}
