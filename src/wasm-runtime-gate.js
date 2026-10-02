export async function verifyWasmRuntime({ instantiate = WebAssembly.instantiate, bytes } = {}) {
  if (!bytes) throw new TypeError('WASM bytes are required');
  try {
    await instantiate(bytes);
    return { supported: true, runtime: 'webassembly' };
  } catch (error) {
    return { supported: false, runtime: 'webassembly', error: String(error) };
  }
}
