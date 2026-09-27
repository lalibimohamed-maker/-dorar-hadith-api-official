/**
 * Rechercher Ω — GitHub repository intelligence.
 *
 * Combines two complementary context paths:
 * 1) GitMCP for targeted documentation/code queries.
 * 2) Gitingest for bounded whole-repository digests.
 *
 * Both are reference/context inputs only. They cannot write Corpus or
 * automatically execute third-party repository code.
 */

const GITHUB_REPO_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/?#].*)?$/i;

export function parseGithubRepositoryUrl(value) {
  const input = String(value ?? "").trim();
  const match = input.match(GITHUB_REPO_RE);
  if (!match) throw new Error("expected a public GitHub repository URL");
  const owner = match[1];
  const repo = match[2].replace(/\.git$/i, "");
  if (!owner || !repo) throw new Error("GitHub repository owner/repository is required");
  return {
    owner,
    repo,
    canonical_url: `https://github.com/${owner}/${repo}`
  };
}

export function buildGitMcpServerUrl(repository) {
  const { owner, repo } =
    typeof repository === "string" ? parseGithubRepositoryUrl(repository) : repository;
  return `https://gitmcp.io/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

export function buildGitMcpQueryPlan(repository, {
  query = null,
  code_query = null,
  include_documentation = true
} = {}) {
  const { owner, repo, canonical_url } =
    typeof repository === "string" ? parseGithubRepositoryUrl(repository) : repository;
  const tools = [];
  if (include_documentation) tools.push({
    name: "fetch_generic_documentation",
    arguments: { owner, repo }
  });
  if (query) tools.push({
    name: "search_generic_documentation",
    arguments: { owner, repo, query: String(query) }
  });
  if (code_query) tools.push({
    name: "search_generic_code",
    arguments: { owner, repo, query: String(code_query), page: 1 }
  });

  return {
    server_url: buildGitMcpServerUrl({ owner, repo }),
    repository_url: canonical_url,
    tools,
    read_only: true,
    robots_policy: "respect_remote_robots_txt_for_web_pages",
    dynamic_server_allowed: false,
    arbitrary_code_execution: false,
    corpus_write_allowed: false,
    generated_media_is_evidence: false
  };
}

export function buildGitingestRequest(repository, {
  max_file_size_kb = 1024,
  pattern_type = "exclude",
  pattern = "",
  token_env = "GITHUB_TOKEN"
} = {}) {
  const parsed =
    typeof repository === "string" ? parseGithubRepositoryUrl(repository) : repository;
  const input_text = parsed.canonical_url;
  if (!Number.isInteger(max_file_size_kb) || max_file_size_kb < 1 || max_file_size_kb > 5120) {
    throw new Error("Gitingest max_file_size_kb must be between 1 and 5120");
  }
  if (!["include", "exclude"].includes(pattern_type)) {
    throw new Error("Gitingest pattern_type must be include or exclude");
  }

  return {
    endpoint: "https://gitingest.com/api/ingest",
    method: "POST",
    body: {
      input_text,
      max_file_size: max_file_size_kb,
      pattern_type,
      pattern: String(pattern ?? "")
    },
    private_repository_token_env: token_env,
    token_never_serialized: true,
    read_only: true,
    corpus_write_allowed: false,
    generated_media_is_evidence: false,
    execution: "digest_only"
  };
}

export async function ingestWithGitingest(repository, {
  max_file_size_kb = 1024,
  pattern_type = "exclude",
  pattern = "",
  token = null,
  fetchImpl = globalThis.fetch
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch implementation is required");
  const request = buildGitingestRequest(repository, {
    max_file_size_kb,
    pattern_type,
    pattern
  });
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetchImpl(request.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...request.body,
      ...(token ? { token } : {})
    })
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Gitingest request failed (HTTP ${response.status}): ${text.slice(0, 500)}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gitingest returned a non-JSON response");
  }

  return {
    repository: typeof repository === "string" ? parseGithubRepositoryUrl(repository) : repository,
    source: "gitingest",
    status: "success",
    digest: parsed,
    corpus_write_allowed: false,
    generated_media_is_evidence: false
  };
}

export function buildRepositoryIntelligencePlan(repository, {
  task = "codebase_understanding",
  documentation_query = null,
  code_query = null,
  max_file_size_kb = 1024,
  pattern_type = "exclude",
  pattern = ""
} = {}) {
  const parsed = typeof repository === "string"
    ? parseGithubRepositoryUrl(repository)
    : repository;

  return {
    schema_version: "1.0.0",
    engine: "rechercher-omega",
    task,
    repository: parsed,
    context_paths: [
      buildGitMcpQueryPlan(parsed, {
        query: documentation_query,
        code_query
      }),
      buildGitingestRequest(parsed, {
        max_file_size_kb,
        pattern_type,
        pattern
      })
    ],
    promotion: {
      repository_context_is_not_scholarly_evidence: true,
      require_provenance: true,
      require_validation: true,
      auto_execute_discovered_code: false,
      corpus_write_allowed: false
    }
  };
}
