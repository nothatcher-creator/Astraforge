import {clamp,lyricClips,retime,type Clip,type Project,type Word} from './model';

export interface AlignmentOptions {windowMs:number;clipIds?:string[];range?:{start:number;end:number};}
export interface AlignmentProposal {
 clipId:string;text:string;originalStart:number;originalEnd:number;baseline:string;
 start:number;end:number;words:Word[];status:'matched'|'review'|'unmatched';reason:string;
 matchedWords:number;estimatedWords:number;totalWords:number;
}
export interface AlignmentReport {projectId:string;duration:number;proposals:AlignmentProposal[];}
const normalize=(s:string)=>s.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const fingerprint=(c:Clip)=>JSON.stringify([c.trackId,c.text,c.start,c.end,c.words]);
function similarity(a:string,b:string){
 if(!a||!b)return 0;if(a===b)return 1;
 if(Math.min(a.length,b.length)<4||Math.max(a.length,b.length)>64)return 0;
 const limit=Math.min(a.length,b.length)>=7?2:1;if(Math.abs(a.length-b.length)>limit)return 0;
 let prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=row;}
 return prev[b.length]<=limit?.8:0;
}
type Recognized=Word&{token:string;index:number};
type Pair={lyric:number;spoken:number;exact:boolean};
function candidates(tokens:string[],spoken:Recognized[],clip:Clip,windowMs:number){
 const n=tokens.length,m=spoken.length,width=m+1;
 const scores=new Float32Array((n+1)*width),directions=new Uint8Array(scores.length);
 for(let i=1;i<=n;i++){scores[i*width]=-i*.9;directions[i*width]=1;}
 for(let i=1;i<=n;i++)for(let j=1;j<=m;j++){
  const at=i*width+j,expected=clip.start+(clip.end-clip.start)*(i-1)/Math.max(1,n);
  const sim=similarity(tokens[i-1],spoken[j-1].token);
  const reward=sim?2.8*sim-.22*Math.min(2,Math.abs(spoken[j-1].start-expected)/windowMs):-1000;
  const match=scores[at-width-1]+reward,skipText=scores[at-width]-.9,skipAudio=scores[at-1]-.4;
  if(match>=skipText&&match>=skipAudio){scores[at]=match;directions[at]=3;}
  else if(skipText>=skipAudio){scores[at]=skipText;directions[at]=1;}
  else{scores[at]=skipAudio;directions[at]=2;}
 }
 const found=new Map<string,{pairs:Pair[];score:number}>();
 for(let end=1;end<=m;end++){
  if(directions[n*width+end]===2)continue;
  let i=n,j=end;const pairs:Pair[]=[];
  while(i>0&&j>0){const d=directions[i*width+j];if(d===3){pairs.push({lyric:i-1,spoken:j-1,exact:tokens[i-1]===spoken[j-1].token});i--;j--;}else if(d===1)i--;else j--;}
  pairs.reverse();if(!pairs.length)continue;
  const key=pairs.map(p=>`${p.lyric}:${p.spoken}`).join(',');
  const first=pairs[0],last=pairs.at(-1)!;
  const distance=(Math.abs(spoken[first.spoken].start-clip.start)+Math.abs(spoken[last.spoken].end-clip.end))/windowMs;
  const score=pairs.reduce((v,p)=>v+(p.exact?1:.8),0)/n-distance*.035;
  found.set(key,{pairs,score});
 }
 return [...found.values()].sort((a,b)=>b.score-a.score);
}

/** Conservative word matching; this is not a phoneme forced aligner or a calibrated confidence score. */
export function alignExistingLyrics(project:Project,recognized:Word[],options:AlignmentOptions):AlignmentReport {
 const windowMs=clamp(Number.isFinite(options.windowMs)?options.windowMs:10000,100,120000);
 const lower=Math.max(0,options.range?.start??0),upper=Math.min(project.duration,options.range?.end??project.duration);
 const valid=recognized.filter(w=>w.text&&Number.isFinite(w.start)&&Number.isFinite(w.end)&&w.end>w.start&&w.start>=lower&&w.start<upper)
  .sort((a,b)=>a.start-b.start).map((w,index)=>({...w,start:Math.round(w.start),end:Math.min(upper,Math.round(w.end)),token:normalize(w.text),index})).filter(w=>w.token&&w.end>w.start);
 const wanted=options.clipIds?new Set(options.clipIds):null;
 const lines=lyricClips(project).filter(c=>(!wanted||wanted.has(c.id))&&!project.tracks.find(t=>t.id===c.trackId)?.locked);
 const lastUsed=new Map<string,number>(),lastEnd=new Map<string,number>();
 const proposals:AlignmentProposal[]=lines.map(c=>{
  const original=c.text.trim().split(/\s+/).filter(Boolean),tokens=original.map(normalize);
  const row:AlignmentProposal={clipId:c.id,text:c.text,originalStart:c.start,originalEnd:c.end,baseline:fingerprint(c),start:c.start,end:c.end,words:[],status:'unmatched',reason:'No reliable word match in this time window.',matchedWords:0,estimatedWords:original.length,totalWords:original.length};
  if(!tokens.length||tokens.length>300){row.reason='Split this line into shorter lines before aligning.';return row;}
  const floor=lastUsed.get(c.trackId)??-1;
  const nearby=valid.filter(w=>w.index>floor&&w.start>=c.start-windowMs&&w.end<=c.end+windowMs);
  if(nearby.length>2000){row.reason='Narrow the search window or split this long line.';return row;}
  const choices=candidates(tokens,nearby,c,windowMs),best=choices[0];
  if(!best||best.pairs.length<Math.min(2,tokens.length)||best.pairs.length/tokens.length<.4)return row;
  const pairs=best.pairs,first=pairs[0],last=pairs.at(-1)!;
  const firstWord=nearby[first.spoken],lastWord=nearby[last.spoken];
  if(lastWord.end-firstWord.start>Math.max(5000,(c.end-c.start)*2,tokens.length*1200)){row.reason='Matching words are too far apart. Narrow the search window.';return row;}
  const durations=pairs.map(p=>nearby[p.spoken].end-nearby[p.spoken].start).sort((a,b)=>a-b);
  const typical=clamp(durations[Math.floor(durations.length/2)],80,700);
  const start=Math.round(Math.max(lower,lastEnd.get(c.trackId)??lower,c.start-windowMs,firstWord.start-first.lyric*typical));
  const end=Math.round(Math.min(upper,c.end+windowMs,lastWord.end+(tokens.length-1-last.lyric)*typical));
  if(end-start<tokens.length||start>firstWord.start)return row;
  const matches=new Map(pairs.map(p=>[p.lyric,nearby[p.spoken]]));
  const words:Word[]=original.map((text,i)=>{const match=matches.get(i);return {text,start:match?.start??0,end:match?.end??0,...(c.words[i]?.text===text&&c.words[i].emphasized?{emphasized:true}:{})};});
  // Only unrecognized words are interpolated; recognized boundaries retain millisecond precision.
  for(let i=0;i<words.length;){if(matches.has(i)){i++;continue;}const begin=i;while(i<words.length&&!matches.has(i))i++;
   const a=begin?words[begin-1].end:start,b=i<words.length?words[i].start:end;
   for(let k=begin;k<i;k++){words[k].start=Math.round(a+(b-a)*(k-begin)/(i-begin));words[k].end=Math.round(a+(b-a)*(k-begin+1)/(i-begin));}
  }
  // Whisper can report overlapping words. Keep the edited karaoke intervals ordered and nonempty.
  for(let i=0;i<words.length;i++){
   words[i].start=Math.round(clamp(words[i].start,i?words[i-1].end:start,end-(words.length-i)));
   words[i].end=Math.round(clamp(words[i].end,words[i].start+1,end-(words.length-i-1)));
   if(i+1<words.length&&words[i+1].start>words[i].start)words[i].end=Math.min(words[i].end,words[i+1].start);
  }
  const alternative=choices.find(v=>v.pairs.length===pairs.length&&Math.abs(nearby[v.pairs[0].spoken].start-firstWord.start)>700&&Math.abs(Math.abs(nearby[v.pairs[0].spoken].start-c.start)-Math.abs(firstWord.start-c.start))<500);
  const anchored=first.lyric===0&&last.lyric===tokens.length-1;
  const allExact=pairs.every(p=>p.exact),coverage=pairs.length/tokens.length;
  const largeGap=pairs.some((p,i)=>i>0&&nearby[p.spoken].start-nearby[pairs[i-1].spoken].end>3500);
  const reliable=anchored&&coverage===1&&allExact&&tokens.length>1&&!alternative&&!largeGap;
  Object.assign(row,{start,end,words,status:reliable?'matched':'review',matchedWords:pairs.length,estimatedWords:tokens.length-pairs.length,
   reason:alternative?'Multiple nearby occurrences. Listen before applying.':!anchored?'First or last word missing; boundary timing is estimated.':!allExact?'Approximate spelling match. Listen before applying.':largeGap?'Long gap between matched words. Check for a repeated section.':tokens.length===1?'Single word; listen to confirm the occurrence.':coverage<.8?'Some words were not recognized. Review estimated timing.':pairs.length<tokens.length?'Boundary words matched; missing words are interpolated.':'First and last words matched.'});
  lastUsed.set(c.trackId,lastWord.index);lastEnd.set(c.trackId,end);
  return row;
 });
 return {projectId:project.id,duration:project.duration,proposals};
}

/** Return the original object for rejected/no-op edits so they create no undo entry. */
export function applyLyricAlignment(project:Project,report:AlignmentReport,acceptedIds:string[]):Project {
 if(project.id!==report.projectId||project.duration!==report.duration)return project;
 const accepted=new Set(acceptedIds),rows=new Map(report.proposals.map(r=>[r.clipId,r]));let changed=false;
 const clips=project.clips.map(c=>{
  const row=rows.get(c.id);
  if(!row||!accepted.has(c.id)||row.status==='unmatched'||project.tracks.find(t=>t.id===c.trackId)?.locked||fingerprint(c)!==row.baseline)return c;
  if(row.start<0||row.end>project.duration||row.end<=row.start||!row.words.length)return c;
  changed=true;return {...retime(c,row.start,row.end),words:row.words,timingSource:'aligned' as const};
 });
 return changed?{...project,clips}:project;
}
