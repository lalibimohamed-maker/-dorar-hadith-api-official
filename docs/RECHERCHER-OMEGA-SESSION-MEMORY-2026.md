# Omega Session Memory — Free Production Profile

Redis is optional and stores session state only. Raw scholarly Corpus content is not stored in the session database.

Start locally with:

docker compose -f runtime/omega-session/docker-compose.yml up -d

Set `OMEGA_REDIS_URL=redis://127.0.0.1:6379` for the session adapter.

The default in-process memory remains volatile when Redis is not configured. This keeps the core free/open and prevents silent persistence of raw conversations.
