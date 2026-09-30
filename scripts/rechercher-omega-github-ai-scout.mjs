#!/usr/bin/env node

/**
 * Rechercher Ω — GitHub AI Scout.
 *
 * Read-only discovery of public GitHub repositories. The scout never:
 * - reads GitHub Actions secrets,
 * - searches source code for API keys,
 * - clones or executes discovered repositories,
 * - promotes a discovered repository into an Omega execution backend automatically.
 */

const TOKEN = process.env.GITHUB_TOKEN ?? "";
const OUTPUT = process.env.OUTPUT ?? "rechercher-omega-github-ai-census.json";
const PER_QUERY = Math.max(1, Math.min(50, Number(process.env.PER_QUERY ?? "30")));

const queries = [
  ["reasoning", "LLM reasoning agent tool use open source"],
  ["open_weights", "open-weight language model reasoning agentic"],
  ["multimodal", "multimodal vision language audio video model"],
  ["vision", "vision language model document understanding"],
  ["ocr", "OCR PDF VLM document parsing multilingual"],
  ["voice", "voice assistant wake word ASR TTS offline"],
  ["speech", "multilingual speech recognition text to speech"],
  ["audio", "audio understanding diarization VAD speech"],
  ["tts", "neural text to speech multilingual open source"],
  ["embedding", "multilingual embeddings retrieval RAG"],
  ["reranking", "multilingual reranker cross encoder retrieval"],
  ["rag", "retrieval augmented generation hybrid search"],
  ["agent", "agent MCP tools local AI"],
  ["mcp", "Model Context Protocol AI tools server"],
  ["inference", "OpenAI compatible inference server local LLM"],
  ["document", "PDF document AI layout table extraction"],
  ["video", "video understanding generation open source AI"],
  ["free_ai", "free AI API inference Gradio Space"],
  ["arabic_ai", "Arabic NLP retrieval embedding OCR language model"]
];

function headers() {
  return {
    accept: "application/vnd.github+json",
    "user-agent": "Rechercher-Omega-GitHub-AI-Scout/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(TOKEN ? { authorization: "Bearer " + TOKEN } : {})
  };
}

async function searchRepositories(query, page = 1) {
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", query + " archived:false");
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(PER_QUERY));
  url.searchParams.set("page", String(page));
  const response = await fetch(url, { headers: headers() });
  if (!response.ok) {
    const body = await response.text();
    throw new Error("GitHub repository search failed: HTTP " + response.status + " " + body.slice(0, 500));
  }
  return response.json();
}

function normalize(repo, category, query) {
  return {
    full_name: repo.full_name,
    html_url: repo.html_url,
    description: repo.description ?? null,
    category,
    query,
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    language: repo.language ?? null,
    license_spdx: repo.license?.spdx_id ?? null,
    archived: repo.archived === true,
    fork: repo.fork === true,
    default_branch: repo.default_branch ?? null,
    updated_at: repo.updated_at ?? null,
    pushed_at: repo.pushed_at ?? null,
    topics: repo.topics ?? [],
    homepage: repo.homepage ?? null
  };
}

const seen = new Map();
const failures = [];

for (const [category, query] of queries) {
  try {
    const payload = await searchRepositories(query);
    for (const repo of payload.items ?? []) {
      if (repo.archived || repo.fork) continue;
      const item = normalize(repo, category, query);
      const existing = seen.get(item.full_name);
      if (existing) {
        existing.categories = [...new Set([...(existing.categories ?? [existing.category]), category])];
        continue;
      }
      delete item.category;
      item.categories = [category];
      seen.set(item.full_name, item);
    }
  } catch (error) {
    failures.push({ category, query, error: String(error) });
  }
}

const report = {
  schema_version: "1.0.0",
  generated_at: new Date().toISOString(),
  source: "GitHub Repository Search API",
  read_only: true,
  secret_harvesting: false,
  auto_execution: false,
  query_count: queries.length,
  queries: queries.map(([category, query]) => ({ category, query })),
  failures,
  repository_count: seen.size,
  repositories: [...seen.values()].sort((a, b) =>
    (b.stars - a.stars) || a.full_name.localeCompare(b.full_name)
  )
};

const fs = await import("node:fs/promises");
await fs.writeFile(OUTPUT, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  output: OUTPUT,
  repository_count: report.repository_count,
  failures: report.failures.length,
  query_count: report.query_count
}, null, 2));
