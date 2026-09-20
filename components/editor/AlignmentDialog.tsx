'use client';
import {useEffect,useRef,useState} from 'react';
import {AudioLines,AlertCircle,Check,Play,ShieldCheck,Square} from 'lucide-react';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Progress} from '@/components/ui/progress';
import {Choice,NumberField} from './Controls';
import {store,useEditor} from '@/lib/lyricforge/store';
import {audioEngine} from '@/lib/lyricforge/audio';
import {lyricClips,formatTime} from '@/lib/lyricforge/model';
import {applyLyricAlignment,type AlignmentReport} from '@/lib/lyricforge/alignment';
import {alignLyricsToAudio,alignmentSourceKey} from '@/lib/lyricforge/alignment-client';
import type {TranscriptionUpdate} from '@/lib/lyricforge/transcription';

export default function AlignmentDialog({close,onImport}:{close:()=>void;onImport:()=>void}){
 const {project}=useEditor();
 const songs=project.clips.filter(c=>c.kind==='audio'&&c.assetId);
 const [selectedIds]=useState(()=>store.selected.filter(id=>project.clips.some(c=>c.id===id&&c.kind==='lyrics')));
 const [song,setSong]=useState(songs[0]?.id||'');
 const [scope,setScope]=useState(selectedIds.length>1?'selected':'all');
 const [windowSeconds,setWindowSeconds]=useState(10);
 const [model,setModel]=useState('Xenova/whisper-tiny.en');
 const [progress,setProgress]=useState<TranscriptionUpdate>({status:'Ready to match your lyrics',progress:0});
 const [report,setReport]=useState<AlignmentReport|null>(null),[accepted,setAccepted]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[listening,setListening]=useState('');
 const controller=useRef<AbortController|null>(null),stopListening=useRef<(()=>void)|null>(null),sourceKey=useRef(''),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();stopListening.current?.();};},[]);
 const reset=()=>{setReport(null);setAccepted([]);setError('');setProgress({status:'Ready to match your lyrics',progress:0});stopListening.current?.();};
 const targets=lyricClips(project).filter(c=>(scope==='all'||selectedIds.includes(c.id))&&!project.tracks.find(t=>t.id===c.trackId)?.locked);
 const run=async()=>{
  reset();audioEngine.pause();setBusy(true);const ctrl=new AbortController();controller.current=ctrl;
  const snapshot=store.project,clip=snapshot.clips.find(c=>c.id===song);
  try{
   if(!clip)throw new Error('Choose an audio clip first.');
   sourceKey.current=alignmentSourceKey(snapshot,clip);
   const result=await alignLyricsToAudio(snapshot,clip,{windowMs:windowSeconds*1000,clipIds:targets.map(c=>c.id)},model,u=>{if(mounted.current)setProgress(u);},ctrl.signal);
   if(!mounted.current)return;setReport(result);setAccepted(result.proposals.filter(p=>p.status==='matched').map(p=>p.clipId));
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
  if(next===current){setError('These lines changed or were locked. Run alignment again.');return;}
  const count=next.clips.filter((c,i)=>c!==current.clips[i]).length;
  store.update(()=>next);stopListening.current?.();close();toast(`${count} lyric ${count===1?'line aligned':'lines aligned'} · Undo restores the previous timing`);
 };
 return <Dialog open onOpenChange={v=>{if(!v&&!busy)close();}}><DialogContent className="studio-dialog alignment-dialog" showCloseButton={!busy}>
  <DialogHeader><div className="dialog-icon"><AudioLines/></div><DialogTitle>Align existing lyrics</DialogTitle><DialogDescription>Find your words in nearby audio and adjust their timing. Your wording, line breaks and styling stay yours.</DialogDescription></DialogHeader>
  {!songs.length?<div className="empty-state"><AudioLines/><p>Import a song, then add or paste your lyrics.</p><button className="primary-button" onClick={()=>{close();onImport();}}>Import song</button></div>:<>
   <fieldset disabled={busy} className="alignment-settings">
    <label className="dialog-field">Audio clip<Choice label="Audio clip to align against" value={song} onChange={v=>{setSong(v);reset();}} options={songs.map(c=>({label:`${project.assets.find(a=>a.id===c.assetId)?.name||c.name} · ${formatTime(c.start)}–${formatTime(c.end)}`,value:c.id}))}/></label>
    <div className="dialog-two"><label className="dialog-field">Lyrics<Choice label="Lyrics to align" value={scope} onChange={v=>{setScope(v);reset();}} options={[{label:'All unlocked lyrics',value:'all'},{label:`Selected lyrics (${selectedIds.length})`,value:'selected',disabled:!selectedIds.length}]}/></label><NumberField label="Search within ±" value={windowSeconds} min={1} max={120} step={1} suffix="seconds" onChange={v=>{setWindowSeconds(v);reset();}}/></div>
    <details className="alignment-advanced"><summary>Recognition options</summary><Choice label="Alignment speech model" value={model} onChange={v=>{setModel(v);reset();}} options={[{label:'English · Tiny · fastest',value:'Xenova/whisper-tiny.en'},{label:'English · Base · more accurate',value:'Xenova/whisper-base.en'},{label:'Multilingual · Tiny',value:'Xenova/whisper-tiny'}]}/></details>
   </fieldset>
   {!report&&!busy&&<p className="hint">{targets.length} unlocked {targets.length===1?'line':'lines'}. Search starts near each line’s current timing. Widen the window if your lyrics are far out of sync. Locked tracks are skipped.</p>}
   {!report&&<p className="privacy-note"><ShieldCheck size={17}/><span>Audio stays on your device. The first run downloads a speech model. Distorted vocals may need manual timing.</span></p>}
   {(busy||progress.progress>0)&&<div className="transcription-progress" role="status"><div><span>{progress.status}</span><strong>{Math.round(progress.progress)}%</strong></div><Progress value={progress.progress}/>{progress.words?.length?<details className="alignment-transcript" open={busy}><summary>Words heard ({progress.words.length})</summary><div className="transcript-output">{progress.words.map(w=>w.text).join(' ')}</div></details>:busy?<p className="hint">Listening for words near your existing lyrics…</p>:null}</div>}
   {error&&<div className="error-box" role="alert"><AlertCircle size={17}/><span>{error}</span></div>}
   {report&&<section className="alignment-review" aria-label="Review timing suggestions">
    <div className="alignment-summary"><strong>{report.proposals.filter(r=>r.status==='matched').length} strong matches</strong><span>{report.proposals.filter(r=>r.status==='review').length} to review · {report.proposals.filter(r=>r.status==='unmatched').length} unchanged</span></div>
    <p className="hint">Only checked lines will change. Missing words are timed between matched words. “Needs review” suggestions start unchecked.</p>
    <div className="alignment-selection"><button onClick={()=>setAccepted(report.proposals.filter(r=>r.status==='matched').map(r=>r.clipId))}>Select strong matches</button><button onClick={()=>setAccepted([])}>Clear selection</button></div>
    <div className="alignment-rows">{report.proposals.map((r,index)=><article key={r.clipId} className={`alignment-row ${r.status}`}>
     <label className="alignment-line"><input type="checkbox" aria-label={`Accept timing for line ${index+1}`} disabled={r.status==='unmatched'} checked={accepted.includes(r.clipId)} onChange={e=>setAccepted(ids=>e.target.checked?[...ids,r.clipId]:ids.filter(id=>id!==r.clipId))}/><span><strong>{r.text}</strong><small>{r.status==='matched'?'Matched':r.status==='review'?'Needs review':'Unchanged'} · {r.matchedWords}/{r.totalWords} words matched{r.estimatedWords&&r.status!=='unmatched'?` · ${r.estimatedWords} estimated`:''}</small></span></label>
     <p>{r.reason}</p>
     <div className="alignment-times"><button aria-label={`Listen to original timing for line ${index+1}`} onClick={()=>audition(r.clipId+'-before',r.originalStart,r.originalEnd)}>{listening===r.clipId+'-before'?<Square size={13}/>:<Play size={13}/>}<span>Before<time>{formatTime(r.originalStart,true)} – {formatTime(r.originalEnd,true)}</time></span></button>{r.status!=='unmatched'&&<button aria-label={`Listen to aligned timing for line ${index+1}`} onClick={()=>audition(r.clipId+'-after',r.start,r.end)}>{listening===r.clipId+'-after'?<Square size={13}/>:<Play size={13}/>}<span>Proposed<time>{formatTime(r.start,true)} – {formatTime(r.end,true)}</time></span></button>}</div>
    </article>)}</div>
   </section>}
   <div className="dialog-action-row alignment-footer">{busy?<button className="soft-button full" onClick={()=>controller.current?.abort()}>Stop alignment</button>:<><button className="soft-button" onClick={close}>Cancel</button><button className={report?'soft-button':'primary-button'} disabled={!targets.length||!song} onClick={()=>void run()}><AudioLines size={16}/>{report?'Analyze again':'Find lyric timings'}</button>{report&&<button className="primary-button" disabled={!accepted.length} onClick={apply}><Check size={16}/>Apply {accepted.length} {accepted.length===1?'line':'lines'}</button>}</>}</div>
  </>}
 </DialogContent></Dialog>;
}
