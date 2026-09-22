'use client';
import {useEffect,useRef,useState} from 'react';
import {AudioLines,AlertCircle,Check,Play,ShieldCheck,Square,LocateFixed} from 'lucide-react';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Progress} from '@/components/ui/progress';
import {Choice,NumberField} from './Controls';
import {store,useEditor} from '@/lib/lyricforge/store';
import {audioEngine} from '@/lib/lyricforge/audio';
import {formatTime} from '@/lib/lyricforge/model';
import {alignmentLines,applyLyricAlignment,type AlignmentReport} from '@/lib/lyricforge/alignment';
import {alignLyricsToAudio,alignmentSourceKey} from '@/lib/lyricforge/alignment-client';
import type {TranscriptionUpdate} from '@/lib/lyricforge/transcription';

export default function AlignmentDialog({close,onImport}:{close:()=>void;onImport:()=>void}){
 const {project}=useEditor();
 const songs=project.clips.filter(c=>c.kind==='audio'&&c.assetId);
 const [selectedIds]=useState(()=>store.selected.filter(id=>project.clips.some(c=>c.id===id&&c.kind==='lyrics')));
 const [song,setSong]=useState(songs[0]?.id||'');
 const [scope,setScope]=useState(selectedIds.length>1?'selected':'all');
 const [mode,setMode]=useState<'nearby'|'song'>(()=>{const lines=alignmentLines(project);return lines.filter(c=>c.timingSource==='estimated').length>lines.length/2?'song':'nearby';});
 const [order,setOrder]=useState<'source'|'timeline'>('source');
 const [settingsOpen,setSettingsOpen]=useState(true);
 const [windowSeconds,setWindowSeconds]=useState(5),[offsetSeconds,setOffsetSeconds]=useState(0);
 const [model,setModel]=useState('Xenova/whisper-base.en');
 const [progress,setProgress]=useState<TranscriptionUpdate>({status:'Ready to match your lyrics',progress:0});
 const [report,setReport]=useState<AlignmentReport|null>(null),[accepted,setAccepted]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[listening,setListening]=useState('');
 const controller=useRef<AbortController|null>(null),stopListening=useRef<(()=>void)|null>(null),sourceKey=useRef(''),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();stopListening.current?.();};},[]);
 const reset=()=>{setReport(null);setAccepted([]);setSettingsOpen(true);setError('');setProgress({status:'Ready to match your lyrics',progress:0});stopListening.current?.();};
 const targets=alignmentLines(project,{mode,order:mode==='song'?order:'timeline',clipIds:scope==='selected'?selectedIds:undefined});
 const strong=report?.proposals.filter(p=>p.status==='matched'&&p.change!=='none')||[];
 const possible=report?.proposals.filter(p=>p.status!=='unmatched'&&p.change!=='none')||[];
 const notFound=report?.proposals.filter(p=>p.status==='unmatched').length||0;
 const alreadyAligned=report?.proposals.filter(p=>p.status!=='unmatched'&&p.change==='none').length||0;
 const delta=(ms:number)=>(ms>0?'+':'')+(ms/1000).toFixed(3)+' s';
 const run=async()=>{
  reset();audioEngine.pause();setBusy(true);const ctrl=new AbortController();controller.current=ctrl;
  const snapshot=store.project,clip=snapshot.clips.find(c=>c.id===song);
  try{
   if(!clip)throw new Error('Choose an audio clip first.');
   sourceKey.current=alignmentSourceKey(snapshot,clip);
   const result=await alignLyricsToAudio(snapshot,clip,{windowMs:windowSeconds*1000,expectedOffsetMs:Math.round(offsetSeconds*1000),mode,order:mode==='song'?order:'timeline',clipIds:targets.map(c=>c.id)},model,u=>{if(mounted.current)setProgress(u);},ctrl.signal);
   if(!mounted.current)return;setReport(result);setSettingsOpen(false);setAccepted(result.proposals.filter(p=>p.status==='matched'&&p.change!=='none').map(p=>p.clipId));
  }catch(e){if(!mounted.current)return;if(e instanceof Error&&e.name==='AbortError')setProgress({status:'Stopped. Your lyrics and timing have not changed.',progress:0});else setError(e instanceof Error?e.message:String(e));}
  finally{if(mounted.current)setBusy(false);}
 };
 const audition=(id:string,start:number,end:number)=>{
  if(listening===id){stopListening.current?.();return;}
  stopListening.current?.();audioEngine.pause();const previousLoop=audioEngine.loop;audioEngine.loop=null;
  let unsubscribe=()=>{};const stop=()=>{unsubscribe();audioEngine.pause();audioEngine.loop=previousLoop;stopListening.current=null;if(mounted.current)setListening('');};
  stopListening.current=stop;setListening(id);audioEngine.seek(Math.max(0,start-300));
  unsubscribe=audioEngine.subscribe(()=>{if(audioEngine.time()>=Math.min(project.duration,end+300))stop();});
  void audioEngine.play().catch(e=>{stop();setError(e instanceof Error?e.message:String(e));});
 };
 const apply=()=>{
  if(!report)return;const current=store.project,clip=current.clips.find(c=>c.id===song);
  if(!clip||alignmentSourceKey(current,clip)!==sourceKey.current){setError('The audio changed while aligning. Run alignment again.');return;}
  const next=applyLyricAlignment(current,report,accepted);
  if(next===current){setError('No timing changed. These lines already match, changed during review, or are now locked.');return;}
  const changes=next.clips.filter((c,i)=>c!==current.clips[i]);
  const moved=changes.filter(c=>{const before=current.clips.find(old=>old.id===c.id)!;return c.start!==before.start||c.end!==before.end;}).length;
  store.update(()=>next);stopListening.current?.();store.select([changes[0].id]);audioEngine.seek(changes[0].start);close();
  toast(`${moved} lyric ${moved===1?'line moved':'lines moved'}${changes.length>moved?` · word timing refined on ${changes.length-moved} more`:''} · ${report.proposals.length-changes.length} unchanged. Undo restores previous timing.`,{duration:10000});
 };
 return <Dialog open onOpenChange={v=>{if(!v&&!busy)close();}}><DialogContent className="studio-dialog alignment-dialog" showCloseButton={!busy}>
  <DialogHeader><div className="dialog-icon"><AudioLines/></div><DialogTitle>Align existing lyrics</DialogTitle><DialogDescription>Find where your lyrics are sung, then review the timing changes. Your wording, line breaks and styling stay yours.</DialogDescription></DialogHeader>
  {!songs.length?<div className="empty-state"><AudioLines/><p>Import a song, then add or paste your lyrics.</p><button className="primary-button" onClick={()=>{close();onImport();}}>Import song</button></div>:<>
   {report&&<button className="alignment-settings-toggle" aria-expanded={settingsOpen} onClick={()=>setSettingsOpen(v=>!v)}>{settingsOpen?'Hide':'Show'} search settings · {mode==='song'?'Whole song':'Nearby timing'}</button>}
   {settingsOpen&&<fieldset disabled={busy} className="alignment-settings">
    <label className="dialog-field">Audio clip<Choice label="Audio clip to align against" value={song} onChange={v=>{setSong(v);reset();}} options={songs.map(c=>({label:`${project.assets.find(a=>a.id===c.assetId)?.name||c.name} · ${formatTime(c.start)}–${formatTime(c.end)}`,value:c.id}))}/></label>
    <label className="dialog-field">Alignment mode<Choice label="Alignment mode" value={mode} onChange={v=>{setMode(v as typeof mode);reset();}} options={[{label:'Find across whole song · for pasted lyrics',value:'song'},{label:'Refine nearby timing',value:'nearby'}]}/></label>
    <div className="dialog-two"><label className="dialog-field">Lyrics<Choice label="Lyrics to align" value={scope} onChange={v=>{setScope(v);reset();}} options={[{label:'All unlocked lyrics',value:'all'},{label:`Selected lyrics (${selectedIds.length})`,value:'selected',disabled:!selectedIds.length}]}/></label>{mode==='nearby'?<NumberField label="Search within ±" value={windowSeconds} min={1} max={120} step={1} suffix="seconds" onChange={v=>{setWindowSeconds(v);reset();}}/>:<label className="dialog-field">Follow lyric order<Choice label="Lyric order" value={order} onChange={v=>{setOrder(v as typeof order);reset();}} options={[{label:'Original paste / import order',value:'source'},{label:'Current timeline order',value:'timeline'}]}/></label>}</div>
    {mode==='song'&&<p className="hint">Searches the entire audio clip, even when your estimated timing is far off. Original order keeps partially moved lines in their pasted sequence. Choose timeline order if you rearranged the lyrics.</p>}
    <label className="dialog-field">Recognition model<Choice label="Alignment speech model" value={model} onChange={v=>{setModel(v);reset();}} options={[{label:'English · Base · standard',value:'Xenova/whisper-base.en'},{label:'English · Small · higher accuracy / more memory',value:'Xenova/whisper-small.en'},{label:'English · Tiny · faster / less memory',value:'Xenova/whisper-tiny.en'},{label:'Multilingual · Base',value:'Xenova/whisper-base'},{label:'Multilingual · Small · more memory',value:'Xenova/whisper-small'},{label:'Multilingual · Tiny',value:'Xenova/whisper-tiny'}]}/></label>
    {model.includes('small')&&<p className="hint">Small uses a larger download and more memory. It can help with difficult vocals, but may run slowly on a phone. Switch to Base or Tiny if it cannot load.</p>}
    {mode==='nearby'&&<details className="alignment-advanced"><summary>Help it find the right song section</summary><p className="hint">If your lyrics start too early or late, set the expected start of the first line below. This guides the search; nothing moves until you apply.</p><div className="alignment-anchor"><NumberField label="First line starts near" value={Math.max(0,(targets[0]?.start||0)/1000+offsetSeconds)} min={0} max={project.duration/1000} step={.1} suffix="seconds" onChange={v=>{setOffsetSeconds(v-(targets[0]?.start||0)/1000);reset();}}/><button className="soft-button" disabled={!targets.length} onClick={()=>{setOffsetSeconds((audioEngine.time()-(targets[0]?.start||0))/1000);reset();}}><LocateFixed size={15}/>Use playhead</button></div><p className="hint">First line: {targets[0]?.text||'Select lyrics first'}. Search shift: {delta(Math.round(offsetSeconds*1000))}.</p></details>}
   </fieldset>}
   {!report&&!busy&&<p className="hint">{targets.length} unlocked {targets.length===1?'line':'lines'}. {mode==='song'?'Repeated phrases and incomplete matches will need review.':'Use whole-song search if these lines only have estimated timing.'} Locked tracks are skipped.</p>}
   {!report&&<p className="privacy-note"><ShieldCheck size={17}/><span>Audio stays on your device. The first run downloads a speech model. Distorted vocals may need manual timing.</span></p>}
   {(busy||progress.progress>0)&&<div className="transcription-progress" role="status"><div><span>{progress.status}</span><strong>{Math.round(progress.progress)}%</strong></div><Progress value={progress.progress}/>{progress.words?.length?<details className="alignment-transcript" open={busy}><summary>Words heard ({progress.words.length})</summary><div className="transcript-output">{progress.words.map(w=>w.text).join(' ')}</div></details>:busy?<p className="hint">{mode==='song'?'Listening through the song for your lyrics…':'Listening for words near your existing lyrics…'}</p>:null}</div>}
   {error&&<div className="error-box" role="alert"><AlertCircle size={17}/><span>{error}</span></div>}
   {report&&<section className="alignment-review" aria-label="Review timing suggestions">
    <div className="alignment-summary"><strong>{strong.length} strong matches</strong><span>{possible.length-strong.length} to review · {notFound} not found · {alreadyAligned} already aligned</span></div>
    <div className="alignment-notice" role="status"><strong>{!possible.length?'No timing changes found.':!strong.length?'No strong matches — review required.':'Suggestions ready. Nothing has moved yet.'}</strong><p>{!possible.length?`Check “Words heard” for recognition errors. ${mode==='nearby'?'Try whole-song search if your starting times are far off.':'Try Small for difficult vocals, or time unrecognized lines manually.'}`:`Listen to the proposed timing and check the lines you want, then tap Apply changes. ${mode==='song'?'Whole-song search can move lines a long way. Repeated and uncertain phrases start unchecked.':'Large jumps and uncertain phrases start unchecked.'}`}</p></div>
    <p className="hint">“Word timing only” refines karaoke highlights without moving the line. Missing words are estimated between recognized words.</p>
    <div className="alignment-selection"><button onClick={()=>setAccepted(strong.map(r=>r.clipId))}>Select strong matches</button><button onClick={()=>setAccepted(possible.map(r=>r.clipId))}>Select all suggestions</button><button onClick={()=>setAccepted([])}>Clear selection</button></div>
    <div className="alignment-rows">{report.proposals.map((r,index)=><article key={r.clipId} className={`alignment-row ${r.status}`}>
     <label className="alignment-line"><input type="checkbox" aria-label={`Accept timing for line ${index+1}`} disabled={r.status==='unmatched'||r.change==='none'} checked={accepted.includes(r.clipId)} onChange={e=>setAccepted(ids=>e.target.checked?[...ids,r.clipId]:ids.filter(id=>id!==r.clipId))}/><span><strong>{r.text}</strong><small>{r.status==='unmatched'?'No match':r.change==='none'?'Already aligned':r.status==='matched'?'Matched':'Needs review'} · {r.matchedWords}/{r.totalWords} words matched{r.estimatedWords&&r.status!=='unmatched'?` · ${r.estimatedWords} estimated`:''}</small></span></label>
     <div className="alignment-delta">{r.status==='unmatched'?'Timing kept':r.change==='none'?'No change needed':r.change==='words'?'Word timing only · line stays in place':`Start ${delta(r.start-r.originalStart)} · End ${delta(r.end-r.originalEnd)}`}</div>
     <p>{r.reason}</p>
     <div className="alignment-times"><button aria-label={`Listen to original timing for line ${index+1}`} onClick={()=>audition(r.clipId+'-before',r.originalStart,r.originalEnd)}>{listening===r.clipId+'-before'?<Square size={13}/>:<Play size={13}/>}<span>Before<time>{formatTime(r.originalStart,true)} – {formatTime(r.originalEnd,true)}</time></span></button>{r.status!=='unmatched'&&<button aria-label={`Listen to aligned timing for line ${index+1}`} onClick={()=>audition(r.clipId+'-after',r.start,r.end)}>{listening===r.clipId+'-after'?<Square size={13}/>:<Play size={13}/>}<span>Proposed<time>{formatTime(r.start,true)} – {formatTime(r.end,true)}</time></span></button>}</div>
    </article>)}</div>
   </section>}
   <div className="dialog-action-row alignment-footer">{busy?<button className="soft-button full" onClick={()=>controller.current?.abort()}>Stop alignment</button>:<><button className="soft-button" onClick={close}>{report?'Close':'Cancel'}</button><button className={report?'soft-button':'primary-button'} disabled={!targets.length||!song} onClick={()=>void run()}><AudioLines size={16}/>{report?'Analyze again':'Find lyric timings'}</button>{report&&<button className="primary-button" disabled={!accepted.length} onClick={apply}><Check size={16}/>Apply changes · {accepted.length} {accepted.length===1?'line':'lines'}</button>}</>}</div>
  </>}
 </DialogContent></Dialog>;
}
