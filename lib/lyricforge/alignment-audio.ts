import type {Clip} from './model';
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
