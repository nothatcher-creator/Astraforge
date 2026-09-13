'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Search,Globe,ArrowLeft,ExternalLink,Bookmark,Plus,LoaderCircle,Check,X,Link2,FileText} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {toast} from 'sonner';
import {store,useEditor} from '@/lib/lyricforge/store';
import {assets} from '@/lib/lyricforge/assets';
import {audioEngine} from '@/lib/lyricforge/audio';
import {makeClip,makeTrack} from '@/lib/lyricforge/model';
import {loadSetting,saveSetting,download} from '@/lib/lyricforge/project-manager';
import {applyCatalogStyle,downloadCatalogFile,fetchCatalog,parseCatalog,searchCommons,type CatalogItem,type CatalogScope} from '@/lib/lyricforge/catalog';
import {CURATED} from '@/lib/lyricforge/catalog/curated';
import {Choice} from './Controls';
import CatalogPreview,{CatalogThumbnail} from './CatalogPreview';

const categories=[['discover','Discover'],['image','Images'],['video','Videos'],['font','Fonts'],['animation','Effects'],['transition','Transitions'],['saved','Saved'],['website','Websites']] as const;
type Category=typeof categories[number][0];
export default function CatalogDialog({close,onImport}:{close:()=>void;onImport:()=>void}) {
  const {project,selected}=useEditor();
  const [category,setCategory]=useState<Category>('discover'),[query,setQuery]=useState(''),[results,setResults]=useState<CatalogItem[]>([]),[saved,setSaved]=useState<CatalogItem[]>([]),[custom,setCustom]=useState<CatalogItem[]>([]);
  const [item,setItem]=useState<CatalogItem|null>(null),[scope,setScope]=useState<CatalogScope>('lyrics'),[searching,setSearching]=useState(false),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState(''),[next,setNext]=useState<number|undefined>();
  const [feedOpen,setFeedOpen]=useState(false),[feedUrl,setFeedUrl]=useState('');
  const searchAbort=useRef<AbortController|null>(null),importAbort=useRef<AbortController|null>(null),mounted=useRef(true),currentQuery=useRef('nature');
  useEffect(()=>{mounted.current=true;void loadSetting<CatalogItem[]>('catalog-bookmarks').then(value=>{if(value&&mounted.current)setSaved(parseCatalog({version:1,items:value}));}).catch(()=>{});void loadSetting<CatalogItem[]>('catalog-custom').then(value=>{if(value&&mounted.current)setCustom(parseCatalog({version:1,items:value}));}).catch(()=>{});return()=>{mounted.current=false;searchAbort.current?.abort();importAbort.current?.abort();};},[]);
  useEffect(()=>{audioEngine.pause();},[]);
  const local=useMemo(()=>[...CURATED,...custom.filter(i=>!CURATED.some(c=>c.id===i.id))],[custom]);
  const visible=useMemo(()=>{
    const base=category==='image'||category==='video'?results:category==='saved'?saved:category==='discover'?local.filter(i=>i.kind!=='website'):local.filter(i=>i.kind===category);
    if(category==='image'||category==='video')return base;
    const needle=query.trim().toLowerCase();return base.filter(i=>[i.title,i.provider,i.description,...i.tags].join(' ').toLowerCase().includes(needle));
  },[category,query,results,local,saved]);
  const search=async(kind:'image'|'video',term:string,offset=0)=>{
    searchAbort.current?.abort();const abort=new AbortController();searchAbort.current=abort;setSearching(true);setError('');if(!offset)setResults([]);currentQuery.current=term;
    try{const response=await searchCommons(term,kind,offset,abort.signal);if(abort.signal.aborted)return;setResults(old=>offset?[...old,...response.items.filter(i=>!old.some(o=>o.id===i.id))]:response.items);setNext(response.next);}
    catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Search failed. Check your connection and try again.');}
    finally{if(!abort.signal.aborted)setSearching(false);}
  };
  const chooseCategory=(value:Category)=>{searchAbort.current?.abort();setSearching(false);setCategory(value);setItem(null);setError('');setNext(undefined);if(value==='image'||value==='video')void search(value,query||'nature');};
  const bookmark=(target:CatalogItem)=>{const values=saved.some(i=>i.id===target.id)?saved.filter(i=>i.id!==target.id):[target,...saved].slice(0,200);setSaved(values);void saveSetting('catalog-bookmarks',values).catch(()=>toast.error('Could not save this bookmark.'));};
  const textSelection=project.clips.some(c=>selected.includes(c.id)&&(c.kind==='text'||c.kind==='lyrics')&&store.editable(c));
  const add=async()=>{
    if(!item||busy)return;
    if(item.recipe){const nextProject=applyCatalogStyle(store.project,store.selected,item.recipe,scope);if(nextProject===store.project){setError('There are no editable lyrics in this scope. Unlock a lyric track or select an unlocked text layer.');return;}store.update(()=>nextProject);toast(item.title+' applied. You can adjust it in Style.');return;}
    const projectId=store.project.id,abort=new AbortController();importAbort.current=abort;setBusy(true);setProgress(0);setError('');
    try{
      const file=await downloadCatalogFile(item,abort.signal,setProgress);abort.signal.throwIfAborted();
      let licenseText:string|undefined;
      if(item.kind==='font'&&item.licenseUrl){const response=await fetch(item.licenseUrl,{signal:abort.signal,credentials:'omit'});if(!response.ok)throw new Error('The font license could not be downloaded. Try again.');licenseText=(await response.text()).slice(0,60000);}
      const asset=await assets.import(file);
      if(abort.signal.aborted||store.project.id!==projectId){assets.remove(asset.id);abort.signal.throwIfAborted();throw new Error('The project changed. Open the catalog in the new project to import this item.');}
      asset.source={url:item.sourceUrl,provider:item.provider,creator:item.creator,license:item.license,licenseUrl:item.licenseUrl,licenseText};
      store.update(p=>{
        const withAsset={...p,assets:[...p.assets,asset]};
        if(asset.type==='font')return applyCatalogStyle(withAsset,store.selected,{font:asset.fontFamily!},scope);
        const track=makeTrack(asset.type,asset.type==='video'?'Background video':'Background image');const start=Math.min(audioEngine.time(),p.duration-10);
        const clip=makeClip(asset.type,track.id,start,p.duration,item.title);clip.assetId=asset.id;clip.style={x:.5,y:.5};
        return {...withAsset,tracks:[...p.tracks,track],clips:[...p.clips,clip]};
      });
      toast(item.kind==='font'?item.title+' added to Project Fonts and applied.':item.title+' added to the timeline.');
    }catch(e){if(!abort.signal.aborted&&mounted.current)setError(e instanceof Error?e.message:'Import failed.');}
    finally{if(mounted.current){setBusy(false);setProgress(0);}}
  };
  const loadFeed=async()=>{searchAbort.current?.abort();const abort=new AbortController();searchAbort.current=abort;setSearching(true);setError('');try{const incoming=await fetchCatalog(feedUrl,abort.signal);if(abort.signal.aborted)return;const updated=[...custom.filter(i=>!incoming.some(n=>n.id===i.id)),...incoming].slice(0,500);setCustom(updated);await saveSetting('catalog-custom',updated);setCategory('discover');setQuery('');setItem(null);setFeedOpen(false);toast(incoming.length+' catalog items added');}catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Catalog unavailable.');}finally{if(!abort.signal.aborted)setSearching(false);}};
  return <Dialog open onOpenChange={open=>{if(!open)close();}}><DialogContent className="catalog-dialog" onInteractOutside={e=>{if(busy)e.preventDefault();}}>
    <DialogHeader className="catalog-heading"><div className="catalog-eyebrow"><Globe size={15}/> THE CREATIVE LIBRARY</div><DialogTitle>Find your next look.</DialogTitle><DialogDescription>Explore online assets. Preview a style. Make it yours.</DialogDescription></DialogHeader>
    <div className="catalog-search-row"><form onSubmit={e=>{e.preventDefault();if(category==='image'||category==='video')void search(category,query);}}><Search size={18}/><input aria-label="Search online catalog" placeholder={category==='image'||category==='video'?'Search Wikimedia Commons…':'Search fonts, styles, moods…'} value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button type="button" aria-label="Clear catalog search" onClick={()=>setQuery('')}><X size={16}/></button>}<button type="submit" className="catalog-search-submit">Search</button></form><button className="catalog-feed-button" disabled={busy} onClick={()=>setFeedOpen(v=>!v)} aria-expanded={feedOpen}><Link2 size={16}/><span>Add catalog</span></button></div>
    {feedOpen&&<form className="catalog-feed-form" onSubmit={e=>{e.preventDefault();void loadFeed();}}><label>Public catalog URL<input type="url" aria-label="Public catalog URL" placeholder="https://example.com/catalog.json" value={feedUrl} onChange={e=>setFeedUrl(e.target.value)} required/></label><button className="soft-button" disabled={searching}>Load catalog</button><p>Use a LyricForge JSON catalog with downloadable assets or compatible effect recipes. <a href="https://github.com/nothatcher-creator/Astraforge/blob/main/docs/catalog-format.md" target="_blank" rel="noopener noreferrer">Catalog format</a></p></form>}
    <div className="catalog-categories" role="group" aria-label="Catalog categories">{categories.map(([id,label])=><button key={id} disabled={busy} aria-pressed={category===id} onClick={()=>chooseCategory(id)}>{label}{id==='saved'&&!!saved.length&&<small>{saved.length}</small>}</button>)}</div>
    <div className={'catalog-body '+(item?'has-detail':'')}>
      <section className="catalog-results" aria-label="Catalog results"><div className="catalog-results-heading"><span>{category==='image'||category==='video'?'Wikimedia Commons · live results':category==='saved'?'Your saved finds':'Curated for lyric videos'}</span><small>{visible.length} items</small></div>
        <div className="catalog-grid">{visible.map(target=><article className={'catalog-card '+(item?.id===target.id?'selected':'')} key={target.id}><button className="catalog-card-preview" aria-label={'Preview '+target.title} onClick={()=>{if(!busy){setItem(target);setError('');}}}><CatalogThumbnail item={target}/><span className="catalog-kind">{target.kind==='animation'?'Text effect':target.kind==='transition'?'Text transition':target.kind==='website'?'Browse website':target.kind}</span></button><div className="catalog-card-copy"><button onClick={()=>{if(!busy)setItem(target);}}>{target.title}</button><small>{target.provider}</small></div><button className="catalog-bookmark" aria-label={(saved.some(i=>i.id===target.id)?'Unsave ':'Save ')+target.title} aria-pressed={saved.some(i=>i.id===target.id)} onClick={()=>bookmark(target)}><Bookmark size={15} fill={saved.some(i=>i.id===target.id)?'currentColor':'none'}/></button></article>)}</div>
        {searching&&<div className="catalog-state" role="status"><LoaderCircle className="spin"/>Searching the library…</div>}
        {!searching&&!visible.length&&<div className="catalog-state"><Search/><strong>{category==='saved'?'Save a little inspiration.':'No matches yet.'}</strong><p>{category==='saved'?'Tap the bookmark on anything you like.':'Try a different phrase, category, or source website.'}</p></div>}
        {next!==undefined&&(category==='image'||category==='video')&&<button className="soft-button full" disabled={searching} onClick={()=>void search(category,currentQuery.current,next)}>Load more</button>}
      </section>
      {item?<aside className="catalog-detail" aria-label="Asset details"><button className="catalog-back" disabled={busy} onClick={()=>setItem(null)}><ArrowLeft size={16}/>Back to results</button><CatalogPreview key={item.id} item={item}/><div className="catalog-detail-copy"><span className="catalog-detail-type">{item.provider}</span><h3>{item.title}</h3><p>{item.description}</p><dl><dt>Creator</dt><dd>{item.creator}</dd><dt>License</dt><dd>{item.licenseUrl?<a href={item.licenseUrl} target="_blank" rel="noopener noreferrer">{item.license}</a>:item.license}</dd>{item.size!==undefined&&<><dt>Original</dt><dd>{(item.size/1e6).toFixed(1)} MB{item.width?` · ${item.width} × ${item.height}`:''}</dd></>}</dl><a className="catalog-source" href={item.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/>Open original source</a>
        {(item.recipe||item.kind==='font')&&<label className="catalog-scope">Apply to<Choice label="Catalog apply scope" value={scope} onChange={value=>setScope(value as CatalogScope)} options={[{label:'All editable lyrics',value:'lyrics'},{label:'Selected text / lyrics',value:'selection',disabled:!textSelection}]}/></label>}
        {item.kind==='website'?<a className="primary-button full" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Browse website<ExternalLink size={15}/></a>:<button className="primary-button full" disabled={busy||((item.recipe||item.kind==='font')&&scope==='selection'&&!textSelection)} onClick={()=>void add()}>{busy?<><LoaderCircle className="spin" size={16}/>{progress?Math.round(progress)+'%':'Downloading…'}</>:item.recipe?<><Check size={16}/>Apply {item.kind==='transition'?'transition':'effect'}</>:<><Plus size={16}/>{item.kind==='font'?'Add font & apply':'Add to project'}</>}</button>}
        {busy&&<button className="soft-button full" onClick={()=>importAbort.current?.abort()}>Cancel download</button>}
        {item.kind==='website'&&<button className="soft-button full" onClick={()=>{close();onImport();}}>Import downloaded file</button>}
      </div></aside>:<aside className="catalog-welcome"><div className="catalog-orbit"><Globe size={37}/></div><h3>A world of possibilities.</h3><p>Select a card to preview it and see import options, credits and license details.</p><div><Check size={14}/> Your audio stays on your device.</div><div><Check size={14}/> Added files save with your project.</div></aside>}
    </div>
    {error&&<div className="catalog-error" role="alert">{error}<button aria-label="Dismiss catalog error" onClick={()=>setError('')}><X size={16}/></button></div>}
    <footer className="catalog-footer"><span>Searches and previews connect to the listed providers.</span><button onClick={()=>download(new Blob([project.assets.filter(a=>a.source).map(a=>`${a.name}\n${a.source!.creator}\n${a.source!.license}\n${a.source!.url}\n${a.source!.licenseUrl||''}\n`).join('\n')],{type:'text/plain'}),'project-credits.txt')} disabled={!project.assets.some(a=>a.source)}><FileText size={14}/>Project credits</button></footer>
  </DialogContent></Dialog>;
}
