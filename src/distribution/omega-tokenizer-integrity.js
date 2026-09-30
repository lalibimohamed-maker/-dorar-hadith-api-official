const HEX_SHA256 = /^[a-f0-9]{64}$/i;

export async function verifyTokenizerFiles(files, expectedFiles) {
  if (!Array.isArray(files) || !Array.isArray(expectedFiles) || files.length !== expectedFiles.length) return false;
  const expected = new Map(expectedFiles.map(item => [String(item.name), String(item.sha256).toLowerCase()]));

  for (const file of files) {
    const name = String(file?.name ?? "");
    const expectedHash = expected.get(name);
    if (!expectedHash || !HEX_SHA256.test(expectedHash)) return false;

    const data = file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file.bytes ?? []);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const actual = [...new Uint8Array(digest)]
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");
    if (actual !== expectedHash) return false;
  }
  return true;
}

export async function assertExactUnicodeRoundTrip(tokenizer, cases = []) {
  if (!tokenizer || typeof tokenizer.encode !== "function" || typeof tokenizer.decode !== "function") {
    throw new TypeError("tokenizer must expose encode() and decode()");
  }

  for (const sample of cases) {
    const input = String(sample?.input ?? "");
    const expected = String(sample?.expected ?? input);
    const ids = tokenizer.encode(input);
    const output = tokenizer.decode(ids, { skip_special_tokens: false });
    if (output !== expected) throw new Error("TOKENIZER_UNICODE_ROUNDTRIP_MISMATCH");
  }
  return true;
}
