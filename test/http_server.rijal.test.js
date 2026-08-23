import assert from 'node:assert/strict';
import http from 'node:http';
import { server } from '../src/http_server.js';

const app = server();
await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
const { port } = app.address();

const record = encodeURIComponent(JSON.stringify({
  narratorId:'rawi:1', primaryName:'راوٍ', identityStatus:'disputed',
  statements:[
    {statementId:'s1',critic:'ناقد أ',sourceId:'book-a',reference:'1/1',text:'ثقة',classification:'taadil'},
    {statementId:'s2',critic:'ناقد ب',sourceId:'book-b',reference:'2/2',text:'ضعيف',classification:'jarh'}
  ]
}));

const result = await new Promise((resolve, reject) => {
  http.get(`http://127.0.0.1:${port}/api/v1/rijal/narrator?record=${record}`, (res) => {
    let body='';
    res.on('data',(chunk)=>{body+=chunk;});
    res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(body)}));
  }).on('error',reject);
});

assert.equal(result.status,200);
assert.equal(result.body.validation.valid,true);
assert.equal(result.body.summary.identityStatus,'disputed');
assert.equal(result.body.summary.statementCount,2);
assert.equal(result.body.statements.every((s)=>s.isIndependentEvidence),true);
app.close();
console.log('rijal HTTP endpoint: OK');
