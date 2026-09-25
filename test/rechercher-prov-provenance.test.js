import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createProvDocument, recordAcquisition, recordDerivation, validateProvShape, PROV_NS, DIN_NS} from '../scripts/rechercher_prov.mjs';

test('PROV profile uses the W3C namespace and Dinullah extension namespace', ()=>{
  const doc=createProvDocument({runId:'test-1'});
  assert.equal(doc.prefix.prov,PROV_NS);
  assert.equal(doc.prefix.din,DIN_NS);
  assert.equal(doc.entity && typeof doc.entity,'object');
  assert.equal(doc.activity && typeof doc.activity,'object');
  assert.equal(doc.agent && typeof doc.agent,'object');
  assert.equal(Object.prototype.hasOwnProperty.call(doc,'din:run_id'),false);
});

test('acquisition is represented as an activity using a source and generating a PDF entity', ()=>{
  const doc=createProvDocument({runId:'run-1'});
  const r=recordAcquisition(doc,{
    runId:'run-1',
    cellId:'english:quran',
    sourceId:'world-001',
    sourceUrl:'https://example.org/quran.pdf',
    sha256:'a'.repeat(64),
    outputPath:'artifacts/quran.pdf',
    rightsStatus:'review_required'
  });
  assert.ok(doc.activity[r.activityId]);
  assert.ok(doc.entity[r.outputId]);
  assert.equal(doc.entity[r.outputId]['din:sha256'],'a'.repeat(64));
  assert.ok(doc.used);
  assert.ok(doc.wasGeneratedBy);
  assert.ok(doc.hadPrimarySource);
  assert.ok(doc.wasAssociatedWith);
  assert.ok(doc.wasAttributedTo);
  const primary=Object.values(doc.hadPrimarySource)[0];
  assert.equal(primary['prov:generatedEntity'],r.outputId);
  assert.equal(primary['prov:usedEntity'],r.sourceId);
  assert.equal(validateProvShape(doc),true);
});

test('DOCX to PDF and other transformations remain explicit derivations', ()=>{
  const doc=createProvDocument({runId:'run-2'});
  recordDerivation(doc,{
    fromEntityId:'din:entity:docx:source',
    toEntityId:'din:entity:pdf:derived',
    activityId:'din:activity:conversion:1',
    activityType:'din:Conversion'
  });
  const rel=Object.values(doc.wasDerivedFrom)[0];
  assert.equal(rel['prov:generatedEntity'],'din:entity:pdf:derived');
  assert.equal(rel['prov:usedEntity'],'din:entity:docx:source');
  assert.equal(Object.values(doc.activity)[0]['prov:type'],'din:Conversion');
});

test('the provenance config explicitly keeps runtime non-blocking', ()=>{
  const config=JSON.parse(fs.readFileSync('config/rechercher/provenance-2026.json','utf8'));
  assert.equal(config.runtime_policy.non_blocking,true);
  assert.equal(config.runtime_policy.provenance_failure_must_not_fail_acquisition,true);
  assert.equal(config.runtime_policy.provenance_failure_must_not_fail_storage,true);
});
