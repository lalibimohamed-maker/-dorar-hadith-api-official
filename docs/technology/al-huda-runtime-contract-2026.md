# AL-HUDA Runtime Contract

This contract adopts reliability patterns observed in VoiceStudio's public release notes without importing its application code.

## Required evidence before reporting a model as ready
- model identity and version
- model license evidence and reviewed status
- SHA-256 verification
- backend and device profile
- successful self-test
- successful inference test with a real input

## Safe failure behavior
Unknown failures are normalized to a safe category. Remote execution is permitted only when the user explicitly opts in, project policy permits it, and the local backend is unavailable.

## Non-negotiable boundaries
- no Corpus mutation
- no implicit remote execution
- Quran recitation uses verified original audio only
- cancellation remains available at each stage
- installation or release presence alone is never runtime proof