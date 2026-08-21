import http from "node:http";
import { URL } from "node:url";
import { detectLanguage } from "./src/language.js";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const DORAR_API_URL = "https://dorar.net/dorar_api.json";
const REQUEST_TIMEOUT_MS = Number(process.env.DORAR_TIMEOUT_MS || 15000);

function sendJson(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "content-type, accept-language"
  });
  res.end(body);
}

function parseDorarPayload(text) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty response from Dorar.net");

  try {
    return JSON.parse(trimmed);
  } catch {
    // The official integration documented by Dorar.net uses JSONP.
    const jsonp = trimmed.match(/^[^(]+\((.*)\)\s*;?\s*$/s);
    if (jsonp) return JSON.parse(jsonp[1]);
  }

  throw new Error("Unexpected response format from Dorar.net");
}

async function searchDorar(query) {
  const callback = `dorarCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const target = new URL(DORAR_API_URL);
  target.searchParams.set("skey", query);
  target.searchParams.set("callback", callback);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(target, {
      headers: {
        accept: "application/json, text/javascript, */*"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Dorar.net returned HTTP ${response.status}`);
    }

    return parseDorarPayload(await response.text());
  } finally {
    clearTimeout(timeout);
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "dorar-hadith-api-official",
      source: "Dorar.net",
      integration: "official-json-api",
      timestamp: new Date().toISOString()
    });
  }

  if (url.pathname === "/") {
    return sendJson(res, 200, {
      name: "Dorar Hadith API Official",
      version: "0.2.0",
      endpoints: {
        health: "/health",
        language: "/language?text=...",
        search: "/search?q=..."
      },
      source: DORAR_API_URL,
      capabilities: [
        "official Dorar.net JSON/JSONP retrieval",
        "automatic input-language detection",
        "language metadata for multilingual clients"
      ]
    });
  }

  if (url.pathname === "/language") {
    const text = (url.searchParams.get("text") || "").trim();
    if (!text) return sendJson(res, 400, { error: "Missing required query parameter: text" });
    return sendJson(res, 200, detectLanguage(text));
  }

  if (url.pathname === "/search") {
    const query = (url.searchParams.get("q") || "").trim();
    if (!query) return sendJson(res, 400, { error: "Missing required query parameter: q" });

    const detectedLanguage = detectLanguage(query);

    try {
      const data = await searchDorar(query);
      return sendJson(res, 200, {
        ok: true,
        query,
        language: detectedLanguage,
        source: "Dorar.net",
        sourceApi: DORAR_API_URL,
        data
      });
    } catch (error) {
      const message = error?.name === "AbortError"
        ? "Dorar.net request timed out"
        : error?.message || "Dorar.net retrieval failed";

      return sendJson(res, 502, {
        ok: false,
        query,
        language: detectedLanguage,
        source: "Dorar.net",
        error: message
      });
    }
  }

  return sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`Dorar API listening on http://${HOST}:${PORT}`);
});
