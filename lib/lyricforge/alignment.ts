import {clamp,lyricClips,retime,type Clip,type Project,type Word} from './model';

export interface AlignmentOptions {windowMs:number;clipIds?:string[];range?:{start:number;end:number};expectedOffsetMs?:number;mode?:'nearby'|'song';order?:'source'|'timeline';}
/** Source order survives partial timing edits; timeline order remains available for rearranged lyrics. */
export function alignmentLines(project:Project,options:Pick<AlignmentOptions,'clipIds'|'mode'|'order'>={}){
 const sourceOrder=options.order==='source'||(!options.order&&options.mode==='song');
 const lines=sourceOrder?project.clips.filter(c=>c.kind==='lyrics'):lyricClips(project);
 const wanted=options.clipIds?new Set(options.clipIds):null;
 return lines.filter(c=>(!wanted||wanted.has(c.id))&&!project.tracks.find(t=>t.id===c.trackId)?.locked);
}
export interface AlignmentProposal {
 clipId:string;text:string;originalStart:number;originalEnd:number;baseline:string;
 start:number;end:number;words:Word[];status:'matched'|'review'|'unmatched';reason:string;
 matchedWords:number;estimatedWords:number;totalWords:number;change:'line'|'words'|'none';
}
export interface AlignmentReport {projectId:string;duration:number;proposals:AlignmentProposal[];}
const normalize=(s:string)=>{const token=s.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');return token==='alright'?'allright':token;};
const fingerprint=(c:Clip)=>JSON.stringify([c.trackId,c.text,c.start,c.end,c.words]);
const sameWords=(a:Word[],b:Word[])=>a.length===b.length&&a.every((w,i)=>w.text===b[i].text&&w.start===b[i].start&&w.end===b[i].end&&!!w.emphasized===!!b[i].emphasized);
function similarity(a:string,b:string){
 if(!a||!b)return 0;if(a===b)return 1;
 if(Math.min(a.length,b.length)<4||Math.max(a.length,b.length)>64)return 0;
 const limit=Math.min(a.length,b.length)>=7?2:1;if(Math.abs(a.length-b.length)>limit)return 0;
 let prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=row;}
 return prev[b.length]<=limit?.8:0;
}
type Recognized=Word&{token:string};
type Pair={lyric:number;spoken:number;spokenEnd:number;exact:boolean};
function candidates(tokens:string[],spoken:Recognized[],clip:Clip,windowMs:number,wholeSong=false){
 const n=tokens.length,m=spoken.length,width=m+1;
 const scores=new Float32Array((n+1)*width),directions=new Uint8Array(scores.length);
 for(let i=1;i<=n;i++){scores[i*width]=-i*.9;directions[i*width]=1;}
 for(let i=1;i<=n;i++)for(let j=1;j<=m;j++){
  const at=i*width+j,expected=clip.start+(clip.end-clip.start)*(i-1)/Math.max(1,n);
  const sim=similarity(tokens[i-1],spoken[j-1].token);
  const reward=sim?2.8*sim-(wholeSong?0:.22*Math.min(2,Math.abs(spoken[j-1].start-expected)/windowMs)):-1000;
  const match=scores[at-width-1]+reward,skipText=scores[at-width]-.9,skipAudio=scores[at-1]-.4;
  // ASR may split one printed word (offstage → off stage). Keep its full interval.
  const joined=j>1&&spoken[j-1].start-spoken[j-2].end<=600&&tokens[i-1]===spoken[j-2].token+spoken[j-1].token;
  const split=joined?scores[at-width-2]+2.8-(wholeSong?0:.22*Math.min(2,Math.abs(spoken[j-2].start-expected)/windowMs)):-Infinity;
  if(split>=match&&split>=skipText&&split>=skipAudio){scores[at]=split;directions[at]=4;}
  else if(match>=skipText&&match>=skipAudio){scores[at]=match;directions[at]=3;}
  else if(skipText>=skipAudio){scores[at]=skipText;directions[at]=1;}
  else{scores[at]=skipAudio;directions[at]=2;}
 }
 const found=new Map<string,{pairs:Pair[];score:number}>();
 for(let end=1;end<=m;end++){
  if(directions[n*width+end]===2)continue;
  let i=n,j=end;const pairs:Pair[]=[];
  while(i>0&&j>0){const d=directions[i*width+j];if(d===4){pairs.push({lyric:i-1,spoken:j-2,spokenEnd:j-1,exact:true});i--;j-=2;}else if(d===3){pairs.push({lyric:i-1,spoken:j-1,spokenEnd:j-1,exact:tokens[i-1]===spoken[j-1].token});i--;j--;}else if(d===1)i--;else j--;}
  pairs.reverse();if(!pairs.length)continue;
  const key=pairs.map(p=>`${p.lyric}:${p.spoken}:${p.spokenEnd}`).join(',');
  const first=pairs[0],last=pairs.at(-1)!;
  const distance=wholeSong?0:(Math.abs(spoken[first.spoken].start-clip.start)+Math.abs(spoken[last.spokenEnd].end-clip.end))/Math.max(1000,windowMs);
  const span=last.spokenEnd-first.spoken+1,skipped=span-pairs.reduce((sum,p)=>sum+p.spokenEnd-p.spoken+1,0);
  const score=pairs.reduce((v,p)=>v+(p.exact?1:.8),0)/n-distance*.12-skipped/span*.25;
  found.set(key,{pairs,score});
 }
 return [...found.values()].sort((a,b)=>b.score-a.score);
}

type Candidate={row:AlignmentProposal;score:number;anchorStart:number;anchorEnd:number;leading:number;trailing:number};
type Chain={score:number;candidate:Candidate;previous?:Chain};
/** Find the best ordered sequence across all lines, allowing unmatched lines to be skipped.
 * A prefix-max tree keeps this O(candidates * log(candidates)); one bad early match
 * cannot greedily reserve the remaining audio or steal the next chorus.
 */
function chooseSequence(groups:Candidate[][]){
 const ends=[...new Set(groups.flatMap(g=>g.map(c=>c.anchorEnd)))].sort((a,b)=>a-b);
 const tree:(Chain|undefined)[]=new Array(ends.length+1);
 const through=(time:number)=>{let lo=0,hi=ends.length;while(lo<hi){const mid=(lo+hi)>>>1;if(ends[mid]<=time)lo=mid+1;else hi=mid;}return lo;};
 const bestBefore=(time:number)=>{let best:Chain|undefined;for(let at=through(time);at>0;at-=at&-at){const item=tree[at];if(item&&(!best||item.score>best.score))best=item;}return best;};
 for(const group of groups){
  // Delay updates until this line is complete: a path may choose at most one proposal per line.
  const updates=group.filter(c=>c.score>0).map(candidate=>{const previous=bestBefore(candidate.anchorStart);return {score:(previous?.score??0)+candidate.score,candidate,previous};});
  for(const chain of updates)for(let at=through(chain.candidate.anchorEnd);at<tree.length;at+=at&-at)if(!tree[at]||chain.score>tree[at]!.score)tree[at]=chain;
 }
 const chosen:Candidate[]=[];
 for(let chain=bestBefore(Infinity);chain;chain=chain.previous)chosen.push(chain.candidate);
 chosen.reverse();
 // Estimated edge words must yield to recognized anchors, never discard real words.
 for(let i=1;i<chosen.length;i++){
  const left=chosen[i-1],right=chosen[i];
  if(left.row.end<=right.row.start)continue;
  if(right.anchorStart-left.anchorEnd<left.trailing+right.leading){
   for(const c of [left,right])if(c.leading||c.trailing)c.row.reason+=' Missing edge words have no clear gap between these lines; check their timing.';
   continue;
  }
  const boundary=Math.round(clamp((left.row.end+right.row.start)/2,left.anchorEnd+left.trailing,right.anchorStart-right.leading));
  left.row.end=Math.min(left.row.end,boundary);right.row.start=Math.max(right.row.start,boundary);
 }
 for(const c of chosen){
  for(let i=0;i<c.leading;i++)c.row.words[i]={...c.row.words[i],start:Math.round(c.row.start+(c.anchorStart-c.row.start)*i/c.leading),end:Math.round(c.row.start+(c.anchorStart-c.row.start)*(i+1)/c.leading)};
  for(let i=0;i<c.trailing;i++){const at=c.row.words.length-c.trailing+i;c.row.words[at]={...c.row.words[at],start:Math.round(c.anchorEnd+(c.row.end-c.anchorEnd)*i/c.trailing),end:Math.round(c.anchorEnd+(c.row.end-c.anchorEnd)*(i+1)/c.trailing)};}
 }
 return chosen;
}

/** Conservative word matching; this is not a phoneme forced aligner or a calibrated confidence score. */
export function alignExistingLyrics(project:Project,recognized:Word[],options:AlignmentOptions):AlignmentReport {
 const wholeSong=options.mode==='song';
 const windowMs=wholeSong?Math.max(100,project.duration):clamp(Number.isFinite(options.windowMs)?options.windowMs:5000,100,120000);
 const offset=clamp(Number.isFinite(options.expectedOffsetMs)?options.expectedOffsetMs!:0,-project.duration,project.duration);
 const lower=Math.max(0,options.range?.start??0),upper=Math.min(project.duration,options.range?.end??project.duration);
 const valid=recognized.filter(w=>w.text&&Number.isFinite(w.start)&&Number.isFinite(w.end)&&w.end>w.start&&w.start>=lower&&w.start<upper)
  .sort((a,b)=>a.start-b.start).map(w=>({...w,start:Math.round(w.start),end:Math.min(upper,Math.round(w.end)),token:normalize(w.text)})).filter(w=>w.token&&w.end>w.start);
 const lines=alignmentLines(project,options);
 // Ignore word splitting too: "alright go" and "all right go" share an occurrence.
 const phraseKey=(c:Clip)=>JSON.stringify([c.trackId,c.text.trim().split(/\s+/).map(normalize).join('')]);
 const repetitions=new Map<string,number>();
 if(wholeSong)for(const c of project.clips)if(c.kind==='lyrics'){const key=phraseKey(c);repetitions.set(key,(repetitions.get(key)||0)+1);}
 const tracks=new Map<string,Candidate[][]>();
 const proposals=lines.map(c=>{
  const original=c.text.trim().split(/\s+/).filter(Boolean),tokens=original.map(normalize);
  const row:AlignmentProposal={clipId:c.id,text:c.text,originalStart:c.start,originalEnd:c.end,baseline:fingerprint(c),start:c.start,end:c.end,words:[],status:'unmatched',reason:'No reliable word match in this time window.',matchedWords:0,estimatedWords:original.length,totalWords:original.length,change:'none'};
  if(!tokens.length||tokens.length>300){row.reason='Split this line into shorter lines before aligning.';return row;}
  const expected={...c,start:c.start+(wholeSong?0:offset),end:c.end+(wholeSong?0:offset)};
  const nearby=wholeSong?valid:valid.filter(w=>w.start>=expected.start-windowMs&&w.end<=expected.end+windowMs);
  if(nearby.length>(wholeSong?5000:2000)){row.reason='Too many recognized words. Use nearby search on a shorter section.';return row;}
  const choices=candidates(tokens,nearby,expected,windowMs,wholeSong),group:Candidate[]=[];
  for(const choice of choices.slice(0,wholeSong?128:24)){
   if(choice.pairs.length<Math.min(2,tokens.length)||choice.pairs.length/tokens.length<.4)continue;
   const pairs=choice.pairs,first=pairs[0],last=pairs.at(-1)!;
   const firstWord=nearby[first.spoken],lastWord=nearby[last.spokenEnd];
   if(lastWord.end-firstWord.start>Math.max(5000,(c.end-c.start)*2,tokens.length*1200))continue;
   const durations=pairs.map(p=>nearby[p.spokenEnd].end-nearby[p.spoken].start).sort((a,b)=>a-b);
   const typical=clamp(durations[Math.floor(durations.length/2)],80,700);
   const start=Math.round(Math.max(lower,expected.start-windowMs,firstWord.start-first.lyric*typical));
   const end=Math.round(Math.min(upper,expected.end+windowMs,lastWord.end+(tokens.length-1-last.lyric)*typical));
   if(end-start<tokens.length||start>firstWord.start)continue;
   const matches=new Map(pairs.map(p=>[p.lyric,{...nearby[p.spoken],end:nearby[p.spokenEnd].end}]));
   const words:Word[]=original.map((text,i)=>{const match=matches.get(i);return {text,start:match?.start??0,end:match?.end??0,...(c.words[i]?.text===text&&c.words[i].emphasized?{emphasized:true}:{})};});
   for(let i=0;i<words.length;){if(matches.has(i)){i++;continue;}const begin=i;while(i<words.length&&!matches.has(i))i++;
    const a=begin?words[begin-1].end:start,b=i<words.length?words[i].start:end;
    for(let k=begin;k<i;k++){words[k].start=Math.round(a+(b-a)*(k-begin)/(i-begin));words[k].end=Math.round(a+(b-a)*(k-begin+1)/(i-begin));}
   }
   // Recognition can report overlapping words. Keep karaoke intervals ordered and nonempty.
   for(let i=0;i<words.length;i++){
    words[i].start=Math.round(clamp(words[i].start,i?words[i-1].end:start,end-(words.length-i)));
    words[i].end=Math.round(clamp(words[i].end,words[i].start+1,end-(words.length-i-1)));
    if(i+1<words.length&&words[i+1].start>words[i].start)words[i].end=Math.min(words[i].end,words[i+1].start);
   }
   const alternative=choices.find(v=>v.pairs.length===pairs.length&&Math.abs(nearby[v.pairs[0].spoken].start-firstWord.start)>700&&(wholeSong||Math.abs(Math.abs(nearby[v.pairs[0].spoken].start-expected.start)-Math.abs(firstWord.start-expected.start))<500));
   const repeatedLyric=wholeSong&&(repetitions.get(phraseKey(c))||0)>1;
   const anchored=first.lyric===0&&last.lyric===tokens.length-1,allExact=pairs.every(p=>p.exact),coverage=pairs.length/tokens.length;
   const largeGap=pairs.some((p,i)=>i>0&&nearby[p.spoken].start-nearby[pairs[i-1].spokenEnd].end>3500);
   const scattered=last.spokenEnd-first.spoken+1>pairs.reduce((sum,p)=>sum+p.spokenEnd-p.spoken+1,0);
   const largeMove=!wholeSong&&Math.max(Math.abs(start-expected.start),Math.abs(end-expected.end))>clamp(windowMs*.5,1000,2500);
   const reliable=anchored&&coverage===1&&allExact&&tokens.length>1&&!alternative&&!repeatedLyric&&!largeGap&&!scattered&&!largeMove;
   const proposal:AlignmentProposal={...row,start,end,words,status:reliable?'matched':'review',matchedWords:pairs.length,estimatedWords:tokens.length-pairs.length,
    change:start!==c.start||end!==c.end?'line':sameWords(c.words,words)?'none':'words',
    reason:alternative?'Multiple occurrences. Listen before applying.':repeatedLyric?'This lyric repeats in your project. Listen to confirm which occurrence was heard.':scattered?'Other words occur between these matches. This may be a different phrase.':largeMove?'Large change from the expected timing. Confirm the song section before applying.':!anchored?'First or last word missing; boundary timing is estimated.':!allExact?'Approximate spelling match. Listen before applying.':largeGap?'Long gap between matched words. Check for a repeated section.':tokens.length===1?'Single word; listen to confirm the occurrence.':coverage<1?'Some words were not recognized. Review estimated timing.':'Complete phrase matched in sequence.'};
   group.push({row:proposal,score:choice.score,anchorStart:words[first.lyric].start,anchorEnd:words[last.lyric].end,leading:first.lyric,trailing:tokens.length-1-last.lyric});
  }
  if(group.length){row.reason='These words fit another lyric better in the song sequence. Timing was kept.';const groups=tracks.get(c.trackId)||[];groups.push(group);tracks.set(c.trackId,groups);}
  return row;
 });
 const chosen=new Map<string,AlignmentProposal>(),originals=new Map(lines.map(c=>[c.id,c]));
 for(const groups of tracks.values())for(const {row} of chooseSequence(groups)){
  const source=originals.get(row.clipId)!;
  row.change=row.start!==source.start||row.end!==source.end?'line':sameWords(source.words,row.words)?'none':'words';
  chosen.set(row.clipId,row);
 }
 return {projectId:project.id,duration:project.duration,proposals:proposals.map(row=>chosen.get(row.clipId)||row)};
}

/** Return the original object for rejected/no-op edits so they create no undo entry. */
export function applyLyricAlignment(project:Project,report:AlignmentReport,acceptedIds:string[]):Project {
 if(project.id!==report.projectId||project.duration!==report.duration)return project;
 const accepted=new Set(acceptedIds),rows=new Map(report.proposals.map(r=>[r.clipId,r]));let changed=false;
 const clips=project.clips.map(c=>{
  const row=rows.get(c.id);
  if(!row||!accepted.has(c.id)||row.status==='unmatched'||project.tracks.find(t=>t.id===c.trackId)?.locked||fingerprint(c)!==row.baseline)return c;
  if(row.start<0||row.end>project.duration||row.end<=row.start||!row.words.length)return c;
  if(c.start===row.start&&c.end===row.end&&sameWords(c.words,row.words))return c;
  changed=true;return {...retime(c,row.start,row.end),words:row.words,timingSource:'aligned' as const};
 });
 return changed?{...project,clips}:project;
}
