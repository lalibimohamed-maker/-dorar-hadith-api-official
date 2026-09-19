import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const out = path.join(root, 'artifacts', 'store-proof');
fs.mkdirSync(out, { recursive: true });
const sourcePage = 'https://waqfeya.net/books/%D8%A7%D9%84%D8%B3%D9%86%D8%A9-bbd00a6b1e264da9a66ac0ef6086c237';

function curl(url, output = null) {
  const args = ['-L', '--fail', '--silent', '--show-error', '--retry', '4', '--connect-timeout', '30', '-A', 'Mozilla/5.0 (compatible; DeenAllahEncyclopedia/2026)'];
  if (output) args.push('-o', output, url);
  else args.push(url);
  return execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
}

const html = curl(sourcePage);
const rights = html.match(/(وقف\s+لله(?:\s+تعالى)?|وقف\s+على\s+طلبة\s+العلم|متاح\s+للتوزيع\s+بحرية|توزيع\s+حر)/u);
if (!rights) throw new Error('Store proof refused: explicit Waqfeya redistribution wording was not found.');

const urls = new Set();
const add = (value) => {
  if (!value) return;
  const normalized = String(value).replaceAll('\\/', '/').replaceAll('&amp;', '&');
  try { urls.add(new URL(normalized, sourcePage).href); } catch {}
};
for (const m of html.matchAll(/(?:href|src|url|downloadUrl|download_url|file)=["']([^"']+)["']/gi)) add(m[1]);
for (const m of html.matchAll(/["'](https?:\/\/archive\.org\/(?:download|details)\/[^"']+)["']/gi)) add(m[1]);

const pdfUrl = [...urls].find((u) => /\.pdf(?:$|[?#])/i.test(u));
if (!pdfUrl) throw new Error('Store proof failed: no PDF URL was exposed by the book page.');

const pdfPath = path.join(out, 'al-sunnah-waqfeya-proof.pdf');
curl(pdfUrl, pdfPath);
if (!fs.existsSync(pdfPath) || fs.statSync(pdfPath).size === 0) throw new Error('Store proof failed: downloaded file is empty.');

const bytes = fs.statSync(pdfPath).size;
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(pdfPath)).digest('hex');
const manifest = {
  title: 'السنة',
  source: 'Waqfeya',
  sourcePage,
  downloadUrl: pdfUrl,
  rightsStatus: 'waqf-explicit',
  rightsEvidence: rights[1],
  bytes,
  sha256,
  storeMode: 'downloadable',
  verifiedAt: new Date().toISOString()
};

fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
