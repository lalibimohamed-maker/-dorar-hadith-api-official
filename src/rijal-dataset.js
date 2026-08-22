const fs = require('fs');
const path = require('path');

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function appendJsonl(file, record) {
  ensureDir(file);
  fs.appendFileSync(file, JSON.stringify(record, null, 0) + '\n', 'utf8');
}

function narratorRecord({ id, name, aliases = [], sourceId, location, verification = 'unverified' }) {
  return { id, name, aliases, sourceId, location, verification };
}

function judgmentRecord({ narratorId, critic, judgment, text, sourceId, location, reason = null, verification = 'unverified' }) {
  return { narratorId, critic, judgment, text, sourceId, location, reason, verification };
}

function linkRecord({ from, to, relation, sourceId, location, verification = 'unverified' }) {
  return { from, to, relation, sourceId, location, verification };
}

module.exports = { appendJsonl, narratorRecord, judgmentRecord, linkRecord };
