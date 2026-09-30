# Rechercher Ω — GitHub AI capability map

This map records reusable ideas discovered from public GitHub projects. It does not copy third-party applications into the scholarly Corpus and does not execute discovered repositories automatically.

## Adopted capability classes

- Voice: openWakeWord, Silero VAD, faster-whisper/Whisper, pyannote.audio, CosyVoice and Kokoro.
- Documents: Docling, PaddleOCR-VL, DeepSeek-OCR, olmOCR, MinerU and MarkItDown.
- Retrieval: BM25/lexical retrieval, BGE-M3, BGE-M3 reranking and BGE-VL, with Qdrant/pgvector as storage adapters.
- Agents/tools: MCP Python SDK, OpenAI-compatible endpoints, selective Hermes-style tool filtering.
- Inference: Ollama, llama.cpp, vLLM, SGLang and OpenVINO behind one execution contract.
- Programming: Qwen3-Coder plus architecture patterns from Aider, Tabby, mini-SWE-agent and Codex CLI.

## Security rule

Public GitHub repositories are evidence for architecture discovery, not a credential source. Omega never searches repositories for API keys, never embeds discovered secrets, and never auto-runs newly discovered code.

Provider credentials remain environment-injected secrets such as `HF_TOKEN`, `GEMINI_API_KEY`, `GROQ_API_KEY`, or an operator-provided OpenAI-compatible key. Free-tier availability and quotas are provider-dependent and are never treated as guaranteed service.

## Current research references

- openWakeWord: https://github.com/dscripka/openWakeWord
- Silero VAD: https://github.com/snakers4/silero-vad
- faster-whisper: https://github.com/SYSTRAN/faster-whisper
- pyannote.audio: https://github.com/pyannote/pyannote-audio
- Whisper: https://github.com/openai/whisper
- CosyVoice: https://github.com/FunAudioLLM/CosyVoice
- Kokoro: https://github.com/hexgrad/kokoro
- PaddleOCR: https://github.com/PaddlePaddle/PaddleOCR
- Docling: https://github.com/docling-project/docling
- DeepSeek-OCR: https://github.com/deepseek-ai/DeepSeek-OCR
- olmOCR: https://github.com/allenai/olmocr
- MinerU: https://github.com/opendatalab/MinerU
- MarkItDown: https://github.com/microsoft/markitdown
- FlagEmbedding/BGE: https://github.com/FlagOpen/FlagEmbedding
- Qdrant: https://github.com/qdrant/qdrant
- pgvector: https://github.com/pgvector/pgvector
- MCP Python SDK: https://github.com/modelcontextprotocol/python-sdk
- Ollama: https://github.com/ollama/ollama
- llama.cpp: https://github.com/ggml-org/llama.cpp
- vLLM: https://github.com/vllm-project/vllm
- SGLang: https://github.com/sgl-project/sglang
- OpenVINO: https://github.com/openvinotoolkit/openvino
- Qwen3: https://github.com/QwenLM/Qwen3
- Qwen3-Omni: https://github.com/QwenLM/Qwen3-Omni
- Qwen3-Coder: https://github.com/QwenLM/Qwen3-Coder
- gpt-oss: https://github.com/openai/gpt-oss
- gpt-oss-safeguard: https://github.com/openai/gpt-oss-safeguard
- EverOS memory: https://github.com/EverMind-AI/EverOS\n- Memoripy evidence-first memory: https://github.com/caspianmoon/memoripy\n- Prismor agent tool guard: https://github.com/PrismorSec/prismor\n- Agent Inspect: https://github.com/rajudandigam/agent-inspect\n- MCP Evals: https://github.com/mclenhard/mcp-evals\n- Tokensave code intelligence: https://github.com/aovestdipaperino/tokensave\n- Roam Code: https://github.com/Cranot/roam-code\n- Aider: https://github.com/Aider-AI/aider
- Tabby: https://github.com/TabbyML/tabby
- mini-SWE-agent: https://github.com/SWE-agent/mini-swe-agent
- Codex CLI: https://github.com/openai/codex

## Automated discovery

`.github/workflows/rechercher-omega-github-ai-scout.yml` runs a read-only GitHub repository census and publishes a short-lived artifact plus a summary. Discovery never promotes a repository directly into execution.
