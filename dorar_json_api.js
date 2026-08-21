import http from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";

function sendJson(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "dorar-hadith-api-official",
      source: "Dorar.net",
      timestamp: new Date().toISOString()
    });
  }

  if (url.pathname === "/") {
    return sendJson(res, 200, {
      name: "Dorar Hadith API Official",
      version: "0.1.0",
      endpoints: {
        health: "/health",
        search: "/search?q=..."
      },
      note: "The search integration is intentionally isolated so the official Dorar.net retrieval method can be implemented and tested without inventing undocumented endpoints."
    });
  }

  if (url.pathname === "/search") {
    const q = (url.searchParams.get("q") || "").trim();
    if (!q) return sendJson(res, 400, { error: "Missing required query parameter: q" });

    return sendJson(res, 501, {
      error: "Search provider integration is not configured yet",
      query: q,
      source: "Dorar.net"
    });
  }

  return sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`Dorar API listening on ${HOST}:${PORT}`);
});
