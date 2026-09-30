import test from "node:test";
import assert from "node:assert/strict";
import {
  parseGithubRepositoryUrl,
  buildGitMcpServerUrl,
  buildGitMcpQueryPlan,
  buildGitingestRequest,
  buildRepositoryIntelligencePlan
} from "../src/rechercher-omega-repository-intelligence.js";

test("GitHub repository URLs normalize safely", () => {
  assert.deepEqual(
    parseGithubRepositoryUrl("https://github.com/coderamp-labs/gitingest.git/tree/main"),
    {
      owner: "coderamp-labs",
      repo: "gitingest",
      canonical_url: "https://github.com/coderamp-labs/gitingest"
    }
  );
});

test("GitMCP stays scoped to the exact repository", () => {
  const plan = buildGitMcpQueryPlan("https://github.com/idosal/git-mcp", {
    query: "MCP tools",
    code_query: "searchRepositoryCode"
  });
  assert.equal(plan.server_url, "https://gitmcp.io/idosal/git-mcp");
  assert.ok(plan.tools.some(t => t.name === "search_generic_documentation"));
  assert.ok(plan.tools.some(t => t.name === "search_generic_code"));
  assert.equal(plan.dynamic_server_allowed, false);
  assert.equal(plan.arbitrary_code_execution, false);
});

test("Gitingest request is bounded and never serializes a token", () => {
  const req = buildGitingestRequest("https://github.com/coderamp-labs/gitingest", {
    max_file_size_kb: 512,
    pattern_type: "include",
    pattern: "src/**"
  });
  assert.equal(req.endpoint, "https://gitingest.com/api/ingest");
  assert.equal(req.body.max_file_size, 512);
  assert.equal(req.body.pattern_type, "include");
  assert.equal(req.token_never_serialized, true);
  assert.equal("token" in req.body, false);
});

test("repository intelligence combines live MCP context with a bounded digest", () => {
  const plan = buildRepositoryIntelligencePlan(
    "https://github.com/idosal/git-mcp",
    { documentation_query: "GitMCP tools", code_query: "robots.txt" }
  );
  assert.equal(plan.context_paths.length, 2);
  assert.equal(plan.promotion.auto_execute_discovered_code, false);
  assert.equal(plan.promotion.corpus_write_allowed, false);
});
