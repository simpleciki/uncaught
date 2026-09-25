// Shows that mutant DP-R2-3 changes real behaviour (it is not an equivalent mutant).
// Run from the repo root: node docs/examples/dp-r2-3-collision.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const source = fs.readFileSync('subject/dot-prop/index.js', 'utf8');
const mutant = JSON.parse(fs.readFileSync('mutants-dot-prop/r2/DP-R2-3.json', 'utf8'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uncaught-example-'));
fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
fs.writeFileSync(path.join(dir, 'original.js'), source);
fs.writeFileSync(path.join(dir, 'mutant.js'), source.replace(mutant.find, mutant.replace));

const original = await import(pathToFileURL(path.join(dir, 'original.js')));
const withBug = await import(pathToFileURL(path.join(dir, 'mutant.js')));
const list = ['a', 'b'];
list['1abc'] = 'collides';
console.log('original:', original.deepKeys({list}).join(', '));
console.log('with bug:', withBug.deepKeys({list}).join(', '));
fs.rmSync(dir, {recursive: true, force: true});
