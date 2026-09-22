import {clamp,type Clip} from './model';
/** Use the same expected section for audio preparation and word matching. */
export function alignmentRequestedRange(lines:Pick<Clip,'start'|'end'>[],duration:number,windowMs:number,offsetMs=0,mode:'nearby'|'song'='nearby'){
 if(!lines.length)throw new Error('Choose at least one lyric line.');
 if(mode==='song')return {start:0,end:duration};
 const offset=clamp(Number.isFinite(offsetMs)?offsetMs:0,-duration,duration);
 const window=clamp(Number.isFinite(windowMs)?windowMs:5000,100,120000);
 return {start:Math.max(0,Math.min(...lines.map(c=>c.start))+offset-window),end:Math.min(duration,Math.max(...lines.map(c=>c.end))+offset+window)};
}
export interface AlignmentAudioWindow {start:number;end:number;sourceOffset:number;sampleCount:number;}
/** All values are milliseconds except sampleCount (16 kHz mono). */
export function alignmentAudioWindow(clip:Clip,sourceDuration:number,from:number,to:number):AlignmentAudioWindow {
 if(![sourceDuration,from,to,clip.start,clip.end,clip.offset].every(Number.isFinite)||sourceDuration<=0)throw new Error('Invalid audio timing.');
 const availableEnd=clip.loop?clip.end:Math.min(clip.end,clip.start+sourceDuration-clip.offset);
 const start=Math.round(Math.max(0,from,clip.start)),end=Math.round(Math.min(to,availableEnd));
 if(end<=start)throw new Error('The selected lyrics do not overlap this audio clip.');
 const sourceOffset=(clip.offset+start-clip.start)%sourceDuration;
 return {start,end,sourceOffset,sampleCount:Math.ceil((end-start)*16)};
}
