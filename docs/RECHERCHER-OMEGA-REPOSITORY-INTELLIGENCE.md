# Rechercher Ω — GitMCP + Gitingest repository intelligence

## Why both

**GitMCP** is the targeted path. The official project exposes repository-scoped documentation and code-search tools; the generic endpoint can fetch documentation, search documentation semantically, and search repository code. It also prioritizes `llms.txt` and respects `robots.txt` for web pages. We use the exact `owner/repo` endpoint rather than the dynamic server by default.

**Gitingest** is the bulk context path. Its API accepts a repository input plus a maximum per-file size and include/exclude pattern and returns a digest containing summary/tree/content. The service also exposes a Python package and CLI and can be self-hosted.

## Omega integration

1. Identify the exact GitHub repository.
2. Use GitMCP for narrow questions and implementation details.
3. Use Gitingest for a bounded repository snapshot when the model needs broader context.
4. Attach provenance: repository URL, branch/revision, tool, timestamp and digest metadata.
5. Treat all repository text as untrusted reference material.
6. Never execute discovered code automatically.
7. Never promote repository context into the scholarly Corpus.

## Codextron / CodeSandbox

The supplied `codextron-dev/git-tutorial` CodeSandbox could not be independently resolved through the available GitHub index in this review, so it is retained as a reference-only entry until the repository identity can be verified. CodeSandbox itself is useful as an ephemeral browser sandbox for demonstrations and UI experiments, not as Omega's production execution backend.

## Sources

- GitMCP: https://github.com/idosal/git-mcp
- GitMCP documentation: https://gitmcp.io/doc
- Gitingest: https://github.com/coderamp-labs/gitingest
- Gitingest API: https://gitingest.com/docs
