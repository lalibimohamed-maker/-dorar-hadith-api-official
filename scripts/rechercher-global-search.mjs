#!/usr/bin/env node
import { globalSearchAnalysts } from '../src/rechercher-global-search.js';

const title = process.argv[2] ?? '';
const author = process.argv[3] ?? '';
const result = await globalSearchAnalysts({ title, author });
console.log(JSON.stringify(result, null, 2));
