const assert = require('assert');
const http = require('http');
const { server } = require('../src/http_server');

const app = server();
app.listen(0, '127.0.0.1', () => {
  const port = app.address().port;
  const request = path => new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${path}`, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    }).on('error', reject);
  });

  (async () => {
    try {
      const search = await request('/api/v1/search?q=%D8%A3%D8%B1%D9%83%D8%A7%D9%86%20%D8%A7%D9%84%D8%A5%D9%8A%D9%85%D8%A7%D9%86&lang=ar');
      assert.strictEqual(search.status, 200);
      assert.strictEqual(search.body.results.length, 1);
      assert.strictEqual(search.body.results[0].trusted, false);

      const concept = await request('/api/v1/concept?term=%D8%A7%D9%84%D8%A5%D9%8A%D9%85%D8%A7%D9%86%20%D8%A8%D8%A7%D9%84%D9%84%D9%87&context=concept%3Aiman-billah&lang=ar');
      assert.strictEqual(concept.status, 200);
      assert.strictEqual(concept.body.duration_seconds, 5);
      assert.strictEqual(concept.body.window, 'medium');

      console.log('HTTP API integration tests: OK');
      app.close(() => process.exit(0));
    } catch (error) {
      console.error(error);
      app.close(() => process.exit(1));
    }
  })();
});
