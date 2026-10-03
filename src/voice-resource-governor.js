export function createVoiceResourceGovernor({
  lowMemoryMb = 512,
  maxCpuPercent = 60,
  thermalStates = ['nominal','fair','serious','critical']
} = {}) {
  return Object.freeze({
    selectModel({ memoryMb = Infinity, cpuPercent = 0, thermal = 'nominal' } = {}) {
      if (!thermalStates.includes(thermal)) throw new TypeError('unknown thermal state');
      if (thermal === 'critical' || memoryMb < lowMemoryMb || cpuPercent > maxCpuPercent) {
        return { model: 'qwen3-asr-0.6b', reason: 'resource-constrained' };
      }
      if (thermal === 'serious') {
        return { model: 'qwen3-asr-0.6b', reason: 'thermal-constrained' };
      }
      return { model: 'qwen3-asr-1.7b', reason: 'normal-resources' };
    }
  });
}
