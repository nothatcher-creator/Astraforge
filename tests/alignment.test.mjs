import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createProject,makeClip} from './.compiled/model.mjs';
import {EditorStore} from './.compiled/store.mjs';
import * as sync from './.compiled/synchronization.mjs';

// Removing nearby word matching must fail this behavior, not a source-text check.
test('existing lyrics use detected first/last words without replacing corrected text',()=>{
 const p=createProject(); p.duration=20000;
 const c=makeClip('lyrics',p.tracks[0].id,4000,8000,"Hello, beautiful WORLD!");
 c.style={color:'#aabbcc'}; c.keyframes=[{id:'k',time:6000,property:'x',value:.4,easing:'linear'}]; p.clips=[c];
 const words=[{text:'hello',start:5100,end:5450},{text:'beautiful',start:5600,end:6200},{text:'world',start:6400,end:6900}];
 assert.equal(typeof sync.alignExistingLyrics,'function','Existing lyric alignment is available');
 const report=sync.alignExistingLyrics(p,words,{windowMs:3000});
 const row=report.proposals[0];
 assert.equal(row.status,'matched');
 assert.deepEqual([row.start,row.end],[5100,6900]);
 const next=sync.applyLyricAlignment(p,report,[c.id]);
 assert.equal(next.clips[0].text,"Hello, beautiful WORLD!");
 assert.deepEqual(next.clips[0].words.map(w=>[w.text,w.start,w.end]),[['Hello,',5100,5450],['beautiful',5600,6200],['WORLD!',6400,6900]]);
 assert.deepEqual(next.clips[0].style,{color:'#aabbcc'});
 assert.equal(next.clips[0].keyframes[0].time,6000);
 assert.equal(p.clips[0].start,4000);
 const store=new EditorStore();store.setProject(p);store.update(q=>sync.applyLyricAlignment(q,report,[c.id]));store.undo();
 assert.deepEqual(store.project,p);
});
const lineProject=(lines)=>{const p=createProject();p.duration=60000;p.clips=lines.map(([s,e,t])=>makeClip('lyrics',p.tracks[0].id,s,e,t));return p;};
const phrase=(text,start)=>text.split(' ').map((text,i)=>({text,start:start+i*400,end:start+i*400+300}));
test('repeated choruses align to nearby occurrences in order',()=>{
 const p=lineProject([[1000,3000,'We rise again'],[21000,23000,'We rise again']]);
 const r=sync.alignExistingLyrics(p,[...phrase('We rise again',1300),...phrase('We rise again',21300)],{windowMs:25000});
 assert.deepEqual(r.proposals.map(c=>[c.start,c.end]),[[1300,2400],[21300,22400]]);
});
test('a missing early line cannot steal a later chorus and block every following line',()=>{
 const p=lineProject([[1000,2500,'Bring me home'],[4000,5500,'Across the ocean'],[8000,9500,'Bring me home']]);
 const r=sync.alignExistingLyrics(p,[...phrase('Across the ocean',4200),...phrase('Bring me home',8200)],{windowMs:10000});
 assert.equal(r.proposals[0].status,'unmatched');
 assert.deepEqual(r.proposals.slice(1).map(c=>[c.start,c.end]),[[4200,5300],[8200,9300]]);
});
test('scattered matching words inside a different phrase are not strong matches',()=>{
 const p=lineProject([[1000,5000,'We ride tonight']]);
 const r=sync.alignExistingLyrics(p,phrase('We wake up ride to town tonight',1100),{windowMs:2000});
 assert.notEqual(r.proposals[0].status,'matched');
});
test('a large unanchored timing jump requires review even for an exact phrase',()=>{
 const p=lineProject([[1000,2500,'Bring me home']]);
 const r=sync.alignExistingLyrics(p,phrase('Bring me home',8200),{windowMs:10000});
 assert.equal(r.proposals[0].status,'review');
});
test('an explicit timing anchor searches the expected section without changing original text',()=>{
 const p=lineProject([[1000,2500,'Bring me home'],[4000,5500,'Across the ocean']]);
 const r=sync.alignExistingLyrics(p,[...phrase('Bring me home',21000),...phrase('Across the ocean',24000)],{windowMs:1000,expectedOffsetMs:20000});
 assert.deepEqual(r.proposals.map(c=>[c.start,c.end]),[[21000,22100],[24000,25100]]);
 assert.equal(p.clips[0].start,1000);assert.equal(r.proposals[0].originalStart,1000);
 const next=sync.applyLyricAlignment(p,r,p.clips.map(c=>c.id));
 assert.equal(next.clips[0].text,'Bring me home');assert.equal(next.clips[1].start,24000);
 assert.deepEqual(sync.alignmentRequestedRange(p.clips,p.duration,1000,20000),{start:20000,end:26500});
 assert.deepEqual(sync.alignmentRequestedRange(p.clips,p.duration,1000,-2000),{start:0,end:4500});
});
test('unchanged alignment creates no edit and distinguishes word-only refinements',()=>{
 const p=lineProject([[1300,2400,'We rise again']]);
 const recognized=phrase('We rise again',1300);
 const r=sync.alignExistingLyrics(p,recognized,{windowMs:2000});
 assert.equal(r.proposals[0].change,'words');
 const next=sync.applyLyricAlignment(p,r,[p.clips[0].id]);
 const second=sync.alignExistingLyrics(next,recognized,{windowMs:2000});
 assert.equal(second.proposals[0].change,'none');
 assert.equal(sync.applyLyricAlignment(next,second,[p.clips[0].id]),next);
});
test('estimated edge words give way to adjacent recognized words instead of stealing their timing',()=>{
 for(const nextStart of [2600,2500]){
  const p=lineProject([[1000,2500,'We rise again'],[2600,4200,'Let the light shine']]);
  const r=sync.alignExistingLyrics(p,[...phrase('We rise again',1300),{text:'the',start:nextStart,end:2900},{text:'light',start:3000,end:3300},{text:'shine',start:3400,end:3700}],{windowMs:2000});
  assert.deepEqual([r.proposals[0].start,r.proposals[0].end,r.proposals[0].matchedWords],[1300,2400,3]);
  assert.equal(r.proposals[0].status,'matched');
  assert.equal(r.proposals[1].status,'review');
  assert.deepEqual([r.proposals[1].start,r.proposals[1].end],[2400,3700]);
  assert.deepEqual(r.proposals[1].words[0],{text:'Let',start:2400,end:nextStart});
 }
 const p=lineProject([[1000,2800,'We rise again tonight'],[2500,4200,'Let the light shine']]);
 const r=sync.alignExistingLyrics(p,[...phrase('We rise again',1300),...phrase('Let the light shine',2500)],{windowMs:2000});
 assert.equal(r.proposals[0].matchedWords,3);assert.equal(r.proposals[1].matchedWords,4);
 assert.deepEqual(r.proposals[0].words.at(-1),{text:'tonight',start:2400,end:2500});
});
test('search boundaries and unrelated speech cannot move a lyric',()=>{
 const p=lineProject([[1000,3000,'We rise again']]);
 for(const words of [phrase('We rise again',10000),phrase('This is unrelated',1100),[]]){
  const r=sync.alignExistingLyrics(p,words,{windowMs:1000});
  assert.equal(r.proposals[0].status,'unmatched');
  assert.equal(sync.applyLyricAlignment(p,r,[p.clips[0].id]),p);
 }
});
test('missing boundary words and approximate spelling require review',()=>{
 const p=lineProject([[1000,5000,'Let the light come pouring in']]);
 const r=sync.alignExistingLyrics(p,phrase('the light come pouring',2000),{windowMs:2000});
 const row=r.proposals[0];assert.equal(row.status,'review');assert.equal(row.matchedWords,4);assert.equal(row.estimatedWords,2);
 const next=sync.applyLyricAlignment(p,r,[p.clips[0].id]);
 assert.equal(next.clips[0].text,p.clips[0].text);
 assert.deepEqual(next.clips[0].words.map(w=>w.text),['Let','the','light','come','pouring','in']);
 for(const w of next.clips[0].words)assert.ok(w.start>=row.start&&w.end<=row.end&&w.end>w.start);
 const q=lineProject([[1000,3000,'Golden evening']]);
 assert.equal(sync.alignExistingLyrics(q,phrase('golden evenin',1500),{windowMs:2000}).proposals[0].status,'review');
});
test('one-word and ambiguous repeated lines are never preselected as reliable',()=>{
 const p=lineProject([[1000,2000,'Hey']]);
 assert.equal(sync.alignExistingLyrics(p,phrase('Hey',1200),{windowMs:1000}).proposals[0].status,'review');
 const q=lineProject([[10000,12000,'We rise again']]);
 const r=sync.alignExistingLyrics(q,[...phrase('We rise again',9000),...phrase('We rise again',11000)],{windowMs:4000});
 assert.equal(r.proposals[0].status,'review');
});
test('missing interior words require opt-in even when both boundaries match',()=>{
 const p=lineProject([[1000,4000,'One two bright stars shine']]);
 const r=sync.alignExistingLyrics(p,[{text:'One',start:1200,end:1500},{text:'two',start:1600,end:1900},{text:'stars',start:2400,end:2700},{text:'shine',start:2800,end:3100}],{windowMs:2000});
 const row=r.proposals[0];
 assert.equal(row.status,'review');assert.equal(row.matchedWords,4);assert.equal(row.estimatedWords,1);
 assert.equal(sync.applyLyricAlignment(p,r,[]),p);
 const accepted=sync.applyLyricAlignment(p,r,[p.clips[0].id]);
 assert.equal(accepted.clips[0].text,'One two bright stars shine');
 assert.deepEqual(accepted.clips[0].words[2],{text:'bright',start:1900,end:2400});
});
test('alignment ignores locked lines and preserves unselected clips',()=>{
 const p=lineProject([[1000,3000,'We rise again'],[12000,14000,'Hello golden evening']]);
 const r=sync.alignExistingLyrics(p,[...phrase('We rise again',1300),...phrase('Hello golden evening',12400)],{windowMs:2000,clipIds:[p.clips[1].id]});
 assert.equal(r.proposals.length,1);
 const n=sync.applyLyricAlignment(p,r,[p.clips[1].id]);assert.equal(n.clips[0],p.clips[0]);assert.equal(n.clips[1].start,12400);
 const locked={...p,tracks:p.tracks.map(t=>({...t,locked:true}))};
 assert.equal(sync.alignExistingLyrics(locked,phrase('We rise again',1300),{windowMs:2000}).proposals.length,0);
 assert.equal(sync.applyLyricAlignment(locked,r,[p.clips[1].id]),locked);
});
test('a changed lyric or different project rejects stale alignment',()=>{
 const p=lineProject([[1000,3000,'We rise again']]);
 const r=sync.alignExistingLyrics(p,phrase('We rise again',1300),{windowMs:2000});
 for(const n of [{...p,id:'different'}, {...p,clips:[{...p.clips[0],text:'A correction'}]}, {...p,clips:[{...p.clips[0],start:800}]}])assert.equal(sync.applyLyricAlignment(n,r,[p.clips[0].id]),n);
});
test('alignment never reuses the same words for successive identical lines',()=>{
 const p=lineProject([[1000,3000,'We rise again'],[2000,4000,'We rise again']]);
 const r=sync.alignExistingLyrics(p,phrase('We rise again',1300),{windowMs:3000});
 assert.equal(r.proposals[0].status,'matched');assert.equal(r.proposals[1].status,'unmatched');
});
test('trimmed and looping audio windows map to the project timeline',()=>{
 const c=makeClip('audio','song',10000,30000);c.offset=5000;c.loop=false;
 assert.deepEqual(sync.alignmentAudioWindow(c,20000,18000,30000),{start:18000,end:25000,sourceOffset:13000,sampleCount:112000});
 c.loop=true;
 assert.deepEqual(sync.alignmentAudioWindow(c,6000,18000,22000),{start:18000,end:22000,sourceOffset:1000,sampleCount:64000});
 assert.throws(()=>sync.alignmentAudioWindow(c,6000,0,8000),/overlap/i);
});
test('timing remains in range with malformed and overlapping recognizer results',()=>{
 const p=lineProject([[0,1500,"Don't stop!"]]);p.duration=2000;
 const r=sync.alignExistingLyrics(p,[{text:'dont',start:100,end:900},{text:'stop',start:700,end:1300},{text:'bad',start:NaN,end:5}],{windowMs:1000});
 const row=r.proposals[0];assert.equal(row.start,100);assert.equal(row.end,1300);
 assert.equal(row.words[0].text,"Don't");assert.ok(row.words[0].end<=row.words[1].start);
});
