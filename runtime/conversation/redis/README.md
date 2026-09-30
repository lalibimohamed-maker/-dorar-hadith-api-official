# Rechercher Omega Conversation Memory — Redis

Free/self-hosted production-style Redis persistence for session metadata.

Rules:
- Set `REDIS_PASSWORD` outside Git.
- The Redis port binds to localhost only by default.
- The application stores conversation digests, not raw message content, through `src/rechercher-omega-redis-memory.js`.
- This component is operational state, never scholarly Corpus.
- The default application memory remains volatile when Redis is not configured.
