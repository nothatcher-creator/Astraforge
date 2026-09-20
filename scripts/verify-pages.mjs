import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';

const root=resolve('dist-pages');
const base=process.env.PAGES_BASE_PATH||'/Astraforge/';
assert.match(base,/^\/(?:[^?#]*\/)?$/,'Pages base must start and end with a slash.');
const html=await readFile(join(root,'index.html'),'utf8');
assert.ok(html.includes(`<base href="${base}"`),'The published HTML must establish the project subpath.');
assert.ok(html.includes('id="root"'),'The editor mount point is missing.');
const urls=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(url=>url!==base);
assert.ok(urls.some(url=>url.endsWith('.js')),'The editor JavaScript was not emitted.');
async function exists(path) {
  const info=await stat(join(root,path));
  assert.ok(info.isFile()&&info.size>0,`Missing or empty build asset: ${path}`);
}
for(const url of urls) {
  const resolved=new URL(url,'https://pages.example'+base);
  assert.equal(resolved.origin,'https://pages.example','The entry point should load its code locally.');
  assert.ok(resolved.pathname.startsWith(base),`Asset escapes the Pages subpath: ${url}`);
  await exists(decodeURIComponent(resolved.pathname.slice(base.length)));
}
for(const name of ['analysis.js','alignment.js','transcription.js','ffmpeg-worker.js','ffmpeg-core.js','ort-wasm-simd-threaded.wasm','ort-wasm-simd-threaded.mjs'])await exists('workers/'+name);
const manifest=JSON.parse(await readFile(join(root,'workers/ffmpeg-manifest.json'),'utf8'));
assert.ok(Array.isArray(manifest.parts)&&manifest.parts.length>0,'The H.264 encoder manifest is empty.');
for(const part of manifest.parts){assert.match(part,/^ffmpeg-core-\d+\.part$/);await exists('workers/'+part);}
const first=await readFile(join(root,'workers',manifest.parts[0]));
assert.deepEqual([...first.subarray(0,4)],[0,97,115,109],'The H.264 encoder data is not WebAssembly.');
await stat(join(root,'.nojekyll'));
console.log(`Verified static editor, ${urls.length} entry assets, transcription and H.264 workers at ${base}`);
