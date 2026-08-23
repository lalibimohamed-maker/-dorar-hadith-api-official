import assert from 'node:assert/strict';
import http from 'node:http';
import { server } from '../src/http_server.js';

const app = server();
await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
const { port } = app.address();

async function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    }).on('error', reject);
  });
}

const search = await get('/api/v1/encyclopedia/search?q=%D8%B5%D8%AD%D9%8A%D8%AD%20%D8%A7%D9%84%D8%A8%D8%AE%D8%A7%D8%B1%D9%8A');
assert.equal(search.status, 200);
assert.equal(search.body.aiRequired, false);
assert.ok(search.body.count > 0);

const source = await get('/api/v1/encyclopedia/source/bukhari');
assert.equal(source.status, 200);
assert.deepEqual(source.body.domains, ['hadith']);

const domain = await get('/api/v1/encyclopedia/domain/hadith');
assert.equal(domain.status, 200);
assert.ok(domain.body.sources.includes('bukhari'));

app.close();
console.log('encyclopedia HTTP endpoints: OK');
