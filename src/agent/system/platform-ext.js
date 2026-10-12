import { performance } from 'perf_hooks';

let lastElu = performance.eventLoopUtilization();

export function getEluCpuLoad() {
  const currentElu = performance.eventLoopUtilization(lastElu);
  lastElu = currentElu;
  
  // Scale process utilization for UI visibility
  const processLoad = Math.floor(currentElu.utilization * 100 * 5);
  return Math.min(processLoad, 100);
}
