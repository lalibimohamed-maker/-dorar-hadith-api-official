import { strict as assert } from 'node:assert';
import { createGlobalKnowledgeSearchEngine, registerSearch, recordSearchResult, advanceSearchStage, publishableResults } from '../src/rechercher-global-knowledge-search-engine.js';

describe('Rechercher global knowledge search', () => {
  it('keeps discovery results non-publishable until identity, rights and evidence conditions are met', () => {
    const e = createGlobalKnowledgeSearchEngine({});
    registerSearch(e,{queryId:'q1',text:'كتاب'});
    recordSearchResult(e,{queryId:'q1',resultId:'r1',sourceId:'s1'});
    assert.equal(publishableResults(e,'q1').length,0);
    recordSearchResult(e,{queryId:'q1',resultId:'r2',sourceId:'s2',identityState:'VERIFIED',rightsStatus:'ALLOWED',evidenceState:'SOURCE_VERIFIED',provenance:{provider:'library'}});
    advanceSearchStage(e,'q1','EVIDENCE');
    assert.equal(publishableResults(e,'q1')[0].sourceId,'s2');
  });
});
