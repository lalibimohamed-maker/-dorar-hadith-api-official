# Dorar Hadith API Official

A Node.js API service intended to provide a clean integration layer for official Dorar.net hadith search and retrieval.

## Status

The repository now contains the initial service scaffold and health endpoint. The official Dorar.net search integration is deliberately not fabricated: it must be implemented against a verified, permitted source/interface before returning hadith search data.

## Run locally

```bash
npm start
```

Endpoints:

- `/health`
- `/search?q=الصلاة`

The `/search` endpoint currently returns HTTP 501 until the verified Dorar.net retrieval integration is added.
