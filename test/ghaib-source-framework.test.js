import fs from 'node:fs';

const file = 'config/ghaib-source-framework-2026.json';
const framework = JSON.parse(fs.readFileSync(file, 'utf8'));

if (!Array.isArray(framework.domains) || framework.domains.length < 15) throw new Error('Ghaib framework is incomplete');
if (!framework.domains.some(x => x.id === 'ruh')) throw new Error('Missing ruh domain');
if (!framework.domains.some(x => x.id === 'paradise')) throw new Error('Missing paradise domain');
if (!framework.domains.some(x => x.id === 'hellfire')) throw new Error('Missing hellfire domain');
if (!framework.evidenceOrder.includes('quran') || !framework.evidenceOrder.includes('sahih_hadith')) throw new Error('Evidence order incomplete');
if (!framework.displayRules.bookPresenceDoesNotProveAuthenticity) throw new Error('Authenticity guard missing');
if (!framework.displayRules.translationIsMeaningOnly) throw new Error('Translation guard missing');
if (!framework.displayRules.unverifiedHiddenFromTrustedAnswer) throw new Error('Unverified-material guard missing');
console.log('Ghaib source framework OK');
