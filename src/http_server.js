const http = require('http');
const { URL } = require('url');
const api = require('./corpus_api');

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function server() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'GET' && url.pathname === '/api/v1/search') {
        const result = api.search(url.searchParams.get('q') || '', {
          language: url.searchParams.get('lang') || 'ar',
          bilingual: url.searchParams.get('bilingual') === 'true'
        });
        return json(res, 200, result);
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/concept') {
        const result = api.concept(
          url.searchParams.get('term') || '',
          url.searchParams.get('context') || '',
          url.searchParams.get('lang') || 'ar'
        );
        return json(res, 200, result);
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/bilingual') {
        return json(res, 200, api.bilingual(
          url.searchParams.get('original') || '',
          url.searchParams.get('translation') || '',
          url.searchParams.get('lang') || 'en'
        ));
      }
      return json(res, 404, { error: 'not_found' });
    } catch (error) {
      return json(res, 500, { error: 'internal_error', message: error.message });
    }
  });
}

module.exports = { server };
