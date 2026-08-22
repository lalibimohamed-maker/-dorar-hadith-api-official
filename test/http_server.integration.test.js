import assert from 'node:assert/strict';
import http from 'node:http';
import { server } from '../src/http_server.js';

const app = server();

await new Promise((resolve, reject) => {
  app.once('error', reject);
  app.listen(0, '127.0.0.1', resolve);
});

const port = app.address().port;

function request(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${path}`, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

try {
  const searchResult = await request('/api/v1/search?q=%D8%A3%D8%B1%D9%83%D8%A7%D9%86%20%D8%A7%D9%84%D8%A5%D9%8A%D9%85%D8%A7%D9%86&lang=ar');
  assert.equal(searchResult.status, 200);
  assert.equal(searchResult.body.results.length, 1);
  assert.equal(searchResult.body.results[0].trusted, false);

  const conceptResult = await request('/api/v1/concept?term=%D8%A7%D9%84%D8%A5%D9%8A%D9%85%D8%A7%D9%86%20%D8%A8%D8%A7%D9%84%D9%84%D9%87&context=concept%3Aiman-billah&lang=ar');
  assert.equal(conceptResult.status, 200);
  assert.equal(conceptResult.body.duration_seconds, 5);
  assert.equal(conceptResult.body.window, 'medium');

  console.log('HTTP API integration tests: OK');
} finally {
  await new Promise(resolve => app.close(resolve));
}
