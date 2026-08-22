const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_FILE = path.join(ROOT, 'config', 'corpus-seed-content-batch-05-2026-08-22.json');
const ROUTING_FILE = path.join(ROOT, 'config', 'corpus-source-routing-2026.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadCorpus() {
  const content = readJson(CONTENT_FILE);
  return Array.isArray(content.records) ? content.records : [];
}

function loadRouting() {
  return readJson(ROUTING_FILE);
}

module.exports = { loadCorpus, loadRouting };
