import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const path='data/corpus/rechercher/docx-links-catalog-2026.json';

test('Document (3) hyperlink inventory is complete and deduplicated',()=>{
 const d=JSON.parse(fs.readFileSync(path,'utf8'));
 assert.equal(d.hyperlinkCount,100);
 assert.equal(d.totalUniqueLinks,61);
 assert.equal(new Set(d.links.map(x=>x.url)).size,61);
 assert.ok(d.links.some(x=>x.url==='https://ketabonline.com/ar'));
 assert.ok(d.links.some(x=>x.url==='https://www.alukah.net/library/'));
 assert.ok(d.links.some(x=>x.url==='https://saaid.net/book/'));
 assert.equal(d.links.filter(x=>x.kind==='navigation').length,3);
});
