import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCatalog,parseCommons,downloadCatalogFile,applyCatalogStyle} from './.compiled/catalog.mjs';
import {publicAssetPath} from './.compiled/public-url.mjs';
import {CURATED} from './.compiled/curated.mjs';
import {createProject,makeClip,makeTrack,effectiveStyle} from './.compiled/model.mjs';

const entry={id:'photo',kind:'image',title:'Photo',provider:'Example',sourceUrl:'https://example.com/photo',license:'CC0',creator:'Author',downloadUrl:'https://example.com/photo.jpg',filename:'photo.jpg',mime:'image/jpeg'};
test('the shipped catalog validates and provides importable fonts and editable motions',()=>{
  assert.equal(CURATED.filter(i=>i.kind==='font').length,20);
  assert.equal(CURATED.filter(i=>i.recipe).length,14);
  assert.ok(CURATED.filter(i=>i.kind==='font').every(i=>i.licenseUrl&&i.downloadUrl));
});
test('catalog validation rejects executable URLs, unknown effects and duplicate IDs',()=>{
  assert.equal(parseCatalog({version:1,items:[entry]})[0].title,'Photo');
  for(const change of [{downloadUrl:'javascript:alert(1)'},{downloadUrl:'https://user:password@example.com/a'},{filename:'../../evil.html'},{mime:'image/svg+xml'},{kind:'font'},{filename:'font.ttf'},{mime:'video/mp4'}])assert.throws(()=>parseCatalog({version:1,items:[{...entry,...change}]}));
  assert.throws(()=>parseCatalog({version:1,items:[entry,entry]}),/duplicate/i);
  assert.throws(()=>parseCatalog({version:1,items:[{...entry,kind:'animation',recipe:{entrance:'Run script'}}]}));
});
test('Commons results preserve license and creator without accepting metadata HTML',()=>{
  const items=parseCommons({query:{pages:[{pageid:7,title:'File:Sky.jpg',imageinfo:[{url:'https://upload.wikimedia.org/sky.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:Sky.jpg',mime:'image/jpeg',size:123,width:800,height:600,extmetadata:{Artist:{value:'<a href="javascript:evil()">Jane &amp; Joe</a>'},LicenseShortName:{value:'CC BY 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by/4.0/'}}}]}]}});
  assert.equal(items.items[0].creator,'Jane & Joe');
  assert.equal(items.items[0].license,'CC BY 4.0');
  assert.equal(items.items[0].filename,'Sky.jpg');
});
test('catalog imports enforce size and reject HTML error pages',async()=>{
  const signal=new AbortController().signal;
  await assert.rejects(downloadCatalogFile(entry,signal,()=>{},async()=>new Response('<html>login</html>',{headers:{'content-type':'text/html'}})),/type/i);
  await assert.rejects(downloadCatalogFile(entry,signal,()=>{},async()=>new Response(new Uint8Array(2),{headers:{'content-type':'image/jpeg','content-length':'900000000'}})),/large/i);
  const file=await downloadCatalogFile(entry,signal,()=>{},async()=>new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/jpeg'}}));
  assert.equal(file.size,3);assert.equal(file.name,'photo.jpg');
});
test('applying an effect changes selected editable text without moving its timing',()=>{
  const p=createProject();p.clips=[makeClip('lyrics',p.tracks[0].id,123,4567,'Hello')];
  const next=applyCatalogStyle(p,[p.clips[0].id],{entrance:'Bounce'},'selection');
  assert.equal(next.clips[0].style.entrance,'Bounce');assert.equal(next.clips[0].start,123);assert.equal(next.clips[0].end,4567);
  p.tracks[0].locked=true;assert.equal(applyCatalogStyle(p,[p.clips[0].id],{entrance:'Bounce'},'selection'),p);
});
test('bundled worker paths resolve under GitHub Pages as well as domain roots',()=>{
  assert.equal(publicAssetPath('/workers/analysis.js','https://example.github.io/Astraforge/'),'/Astraforge/workers/analysis.js');
  assert.equal(publicAssetPath('favicon.svg','https://example.com/'),'/favicon.svg');
});
test('all-lyrics effects preserve locked lyrics and independent title and visualizer styles',()=>{
  const p=createProject(),locked=makeTrack('lyrics','Locked lyrics'),title=makeTrack('text','Title'),visualizer=makeTrack('visualizer','Visualizer');
  locked.locked=true;p.tracks.push(locked,title,visualizer);
  p.clips=[makeClip('lyrics',p.tracks[0].id,0,2000,'Editable'),makeClip('lyrics',locked.id,0,2000,'Locked'),makeClip('text',title.id,0,2000,'Title'),makeClip('visualizer',visualizer.id,0,2000)];
  const oldStyles=p.clips.slice(1).map(c=>effectiveStyle(p,c));
  const next=applyCatalogStyle(p,[],{font:'New font',glow:40,entrance:'Bounce'},'lyrics');
  assert.equal(effectiveStyle(next,next.clips[0]).font,'New font');
  assert.equal(next.lyricStyle.entrance,'Bounce');
  assert.deepEqual(next.clips.slice(1).map(c=>effectiveStyle(next,c)),oldStyles);
  p.tracks[0].locked=true;assert.equal(applyCatalogStyle(p,[],{entrance:'Bounce'},'lyrics'),p);
});
