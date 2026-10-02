export async function renderLongFormJob({
  jobId,
  manifestHash,
  chunks,
  checkpointStore,
  renderChunk,
  onProgress = () => {},
} = {}) {
  if (!jobId || !manifestHash) throw new TypeError('jobId and manifestHash are required');
  if (!Array.isArray(chunks) || chunks.length === 0) throw new TypeError('chunks must be a non-empty array');
  if (!checkpointStore?.save || !checkpointStore?.resume) throw new TypeError('checkpointStore is required');
  if (typeof renderChunk !== 'function') throw new TypeError('renderChunk function is required');

  const prior = checkpointStore.resume(jobId, manifestHash);
  const startIndex = prior?.nextChunkIndex ?? 0;
  const outputs = [];

  for (let index = startIndex; index < chunks.length; index += 1) {
    const outputRef = await renderChunk(chunks[index], {
      jobId,
      chunkIndex: index,
      totalChunks: chunks.length,
    });
    if (!outputRef) throw new Error(`chunk ${index} produced no output`);
    checkpointStore.save({
      jobId,
      manifestHash,
      chunkIndex: index,
      totalChunks: chunks.length,
      status: 'completed',
      outputRef,
    });
    outputs.push(outputRef);
    onProgress({
      jobId,
      sequence: index + 1,
      chunkIndex: index,
      totalChunks: chunks.length,
      completed: index === chunks.length - 1,
      outputRef,
    });
  }

  return Object.freeze({
    jobId,
    resumedFrom: startIndex,
    outputs,
    completed: outputs.length === chunks.length - startIndex,
  });
}
