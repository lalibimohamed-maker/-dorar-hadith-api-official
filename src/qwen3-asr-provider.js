import { spawn } from 'node:child_process';

export function createQwen3ASRProvider({
  modelPath,
  python = 'python3',
  runnerPath = 'scripts/qwen3-asr-runner.py',
  timeoutMs = 120_000,
} = {}) {
  if (!modelPath) throw new TypeError('modelPath is required');

  return Object.freeze({
    supports(capability) {
      return capability === 'speech-to-text' || capability === 'language-identification';
    },

    async execute({ audioPath, language = null } = {}) {
      if (!audioPath) throw new TypeError('audioPath is required');
      const payload = JSON.stringify({ model: modelPath, audio: audioPath, language });

      return await new Promise((resolve, reject) => {
        const child = spawn(python, [runnerPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error('Qwen3-ASR inference timeout'));
        }, timeoutMs);

        child.stdout.on('data', chunk => { stdout += chunk; });
        child.stderr.on('data', chunk => { stderr += chunk; });
        child.on('error', error => {
          clearTimeout(timer);
          reject(error);
        });
        child.on('close', code => {
          clearTimeout(timer);
          if (code !== 0) {
            reject(new Error(stderr.trim() || `Qwen3-ASR runner exited with code ${code}`));
            return;
          }
          try {
            const result = JSON.parse(stdout.trim().split('\n').filter(Boolean).at(-1));
            if (!result.ok) throw new Error(result.error || 'Qwen3-ASR returned an error');
            if (!result.text?.trim()) throw new Error('Qwen3-ASR returned an empty transcript');
            resolve({
              text: result.text,
              language: result.language || null,
              engine: 'qwen3-asr',
              provenance: 'local-runtime',
            });
          } catch (error) {
            reject(error);
          }
        });
        child.stdin.end(payload + '\n');
      });
    },
  });
}
