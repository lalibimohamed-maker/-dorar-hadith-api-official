import test from 'node:test';
import assert from 'node:assert/strict';
import { JURISDICTIONS, RIGHTS_DECISIONS, classifyEdition, extractMetadataFromHtml, publicDomainByDeath } from '../src/rechercher-rights-engine.js';

test('life plus 50 public-domain calculation is jurisdiction-aware',()=>{
 const r=publicDomainByDeath(1956,JURISDICTIONS.DZ,2026);
 assert.equal(r.publicDomain,true); assert.equal(r.publicDomainYear,2007);
 const sa=publicDomainByDeath(2020,JURISDICTIONS.SA,2026); assert.equal(sa.publicDomain,false);
});

test('public-domain work with modern critical edition is held for edition review',()=>{
 const r=classifyEdition({author:'عبد الرحمن السعدي',authorDeathYear:1956,editor:'محقق حديث',publisher:'دار حديثة',editionYear:2005,editionType:'critical-edition'},{jurisdiction:JURISDICTIONS.DZ,asOfYear:2026});
 assert.equal(r.decision,RIGHTS_DECISIONS.WORK_PD_EDITION_REVIEW);
 assert.equal(r.editionNeedsReview,true);
});

test('explicit license can clear edition barrier',()=>{
 const r=classifyEdition({author:'قديم',authorDeathYear:1800,editor:'محقق',publisher:'ناشر',editionYear:2024,license:'CC BY 4.0'},{jurisdiction:JURISDICTIONS.DZ,asOfYear:2026});
 assert.equal(r.decision,RIGHTS_DECISIONS.LICENSED);
});

test('reserved rights never become permission',()=>{
 const r=extractMetadataFromHtml('<html><head><meta name="rights" content="All rights reserved"></head><body>جميع الحقوق محفوظة</body></html>');
 assert.match(r.rights,/All rights reserved/i);
 assert.ok(r.rightsSignals.some(x=>x.kind==='copyright-reservation'));
});
