import os from 'os';

let lastCpuInfo = os.cpus() || [];

export function getOsCpuLoad() {
  const currentCpuInfo = os.cpus();
  
  // Return null to trigger the Android fallback if OS blocks access
  if (!currentCpuInfo || currentCpuInfo.length === 0 || currentCpuInfo[0].times.user === 0) {
    return null; 
  }

  let idleDiff = 0;
  let totalDiff = 0;

  for (let i = 0; i < currentCpuInfo.length; i++) {
    const prev = lastCpuInfo[i].times;
    const curr = currentCpuInfo[i].times;
    
    const prevTotal = Object.values(prev).reduce((a, b) => a + b, 0);
    const currTotal = Object.values(curr).reduce((a, b) => a + b, 0);
    
    totalDiff += (currTotal - prevTotal);
    idleDiff += (curr.idle - prev.idle);
  }

  lastCpuInfo = currentCpuInfo;
  const load = 100 - Math.floor(100 * idleDiff / totalDiff);
  return isNaN(load) ? 0 : load;
}

export function getOsMemory() {
  const totalMem = os.totalmem();
  if (!totalMem) return null;
  
  const freeMem = os.freemem();
  return {
    used: ((totalMem - freeMem) / 1073741824).toFixed(2), // Convert bytes to GB
    total: (totalMem / 1073741824).toFixed(2)
  };
}
