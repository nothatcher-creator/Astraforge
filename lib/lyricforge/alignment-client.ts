'use client';
import {audioEngine} from './audio';
import {alignmentAudioWindow,alignmentRequestedRange} from './alignment-audio';
import {LocalWhisper,type TranscriptionUpdate} from './transcription';
import {publicAssetPath} from './public-url';
import {type Clip,type Project,type Word} from './model';
import {alignmentLines,type AlignmentOptions,type AlignmentReport} from './alignment';

// A bounded session cache avoids re-listening when only the search tolerance changes.
const cache:{key:string;start:number;end:number;words:Word[]}[]=[];
export function alignmentSourceKey(project:Project,clip:Clip){return JSON.stringify([project.id,project.duration,clip.assetId,clip.start,clip.end,clip.offset,clip.loop]);}
function matchInWorker(project:Project,words:Word[],options:AlignmentOptions,signal:AbortSignal){
 return new Promise<AlignmentReport>((resolve,reject)=>{
  signal.throwIfAborted();
  // The Pages worker has a stable filename; invalidate older matcher code.
  const worker=new Worker(publicAssetPath('workers/alignment.js')+'?v=0.5.2',{type:'module'});
  const stop=()=>{worker.terminate();signal.removeEventListener('abort',abort);};
  const abort=()=>{stop();reject(new DOMException('Alignment cancelled','AbortError'));};
  signal.addEventListener('abort',abort,{once:true});
  worker.onerror=e=>{stop();reject(new Error(e.message||'Could not align these lyrics.'));};
  worker.onmessage=({data})=>{stop();data.error?reject(new Error(data.error)):resolve(data.report);};
  worker.postMessage({project,words,options});
 });
}
export async function alignLyricsToAudio(project:Project,clip:Clip,options:AlignmentOptions,model:string,onProgress:(u:TranscriptionUpdate)=>void,signal:AbortSignal){
 signal.throwIfAborted();
 const lines=alignmentLines(project,options);
 if(!lines.length)throw new Error('Choose at least one unlocked lyric line.');
 const buffer=audioEngine.buffers.get(clip.assetId||'');
 if(!buffer)throw new Error('Import or reopen this audio before aligning lyrics.');
 const requested=alignmentRequestedRange(lines,project.duration,options.windowMs,options.expectedOffsetMs,options.mode);
 const range=alignmentAudioWindow(clip,buffer.duration*1000,requested.start,requested.end);
 const key=alignmentSourceKey(project,clip)+model;
 const cached=cache.find(c=>c.key===key&&c.start<=range.start&&c.end>=range.end);
 let words:Word[];
 if(cached){words=cached.words;onProgress({status:'Using words already detected in this session…',progress:94,words});}
 else{
  onProgress({status:options.mode==='song'?'Preparing the full audio clip…':'Preparing the audio near your lyrics…',progress:0});
  const ctx=new OfflineAudioContext(1,range.sampleCount,16000),source=ctx.createBufferSource();
  source.buffer=buffer;source.loop=clip.loop;source.connect(ctx.destination);
  source.start(0,range.sourceOffset/1000,(range.end-range.start)/1000);
  const rendered=await ctx.startRendering();signal.throwIfAborted();
  const inProjectTime=(ws:Word[])=>ws.map(w=>({...w,start:w.start+range.start,end:Math.min(range.end,w.end+range.start)}));
  const result=await new LocalWhisper(model).transcribe(rendered.getChannelData(0),u=>onProgress({...u,progress:u.progress*.93,...(u.words?{words:inProjectTime(u.words)}:{})}),signal);
  signal.throwIfAborted();words=inProjectTime(result);
  cache.unshift({key,start:range.start,end:range.end,words});cache.splice(2);
 }
 onProgress({status:'Matching your words and checking line boundaries…',progress:95,words});
 const report=await matchInWorker(project,words,{...options,range},signal);
 onProgress({status:'Timing suggestions ready to review',progress:100,words});
 return report;
}
