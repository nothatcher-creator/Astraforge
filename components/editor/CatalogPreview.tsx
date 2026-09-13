'use client';
import {useEffect,useRef,useState} from 'react';
import {LoaderCircle,Play,Sparkles,Globe,Type} from 'lucide-react';
import {createProject,makeClip} from '@/lib/lyricforge/model';
import {Renderer} from '@/lib/lyricforge/renderer';
import {downloadCatalogFile,type CatalogItem} from '@/lib/lyricforge/catalog';

export default function CatalogPreview({item}:{item:CatalogItem}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const [font,setFont]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(false);
  useEffect(()=>{
    setError('');setFont('');
    if(item.kind!=='font')return;
    const abort=new AbortController();let face:FontFace|undefined;setLoading(true);
    void downloadCatalogFile(item,abort.signal,()=>{}).then(file=>file.arrayBuffer()).then(async bytes=>{
      face=new FontFace('Catalog '+item.id,bytes);await face.load();if(abort.signal.aborted)return;
      document.fonts.add(face);setFont(face.family);
    }).catch(e=>{if(!abort.signal.aborted)setError(e.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>{abort.abort();if(face)document.fonts.delete(face);};
  },[item.id]);
  useEffect(()=>{
    if(!item.recipe||!canvas.current)return;
    const renderer=new Renderer(),project=createProject('Effect preview');project.width=960;project.height=540;project.duration=3600;
    project.background={type:'gradient',color:'#1b2030',color2:'#594536',angle:130,vignette:.5,motion:.3};
    project.lyricStyle={...project.lyricStyle,size:82,karaoke:'Off',shadow:12,...item.recipe};
    project.clips=[makeClip('lyrics',project.tracks[0].id,200,3200,'Make every word move')];
    let raf=0;const start=performance.now();
    const draw=()=>{renderer.draw(canvas.current!,project,(performance.now()-start)%3600);raf=requestAnimationFrame(draw);};draw();
    return()=>{cancelAnimationFrame(raf);renderer.dispose();};
  },[item.id]);
  return <div className={'catalog-preview preview-'+item.kind}>
    {item.recipe?<canvas ref={canvas} width={960} height={540} aria-label={'Animated preview of '+item.title}/>:
      item.kind==='font'?<div className="catalog-font-sample" style={{fontFamily:font?`"${font}"`:'inherit'}}><span>Let the music<br/>tell your story.</span><small>Aa Bb Cc · 0123456789</small>{loading&&<LoaderCircle className="spin" size={20}/>}</div>:
      item.kind==='image'?<img src={item.thumbnail||item.downloadUrl} alt={item.title} onError={()=>setError('Preview unavailable. Open the source page to view it.')}/>:
      item.kind==='video'?<video src={item.downloadUrl} poster={item.thumbnail} controls playsInline preload="metadata" aria-label={'Video preview of '+item.title} onError={()=>setError('This browser cannot preview the original. Open the source page for another format.')}/>:
      <div className="catalog-website-preview"><Globe size={42}/><span>Browse the original library</span></div>}
    {error&&<p className="catalog-preview-error" role="status">{error}</p>}
  </div>;
}

export function CatalogThumbnail({item}:{item:CatalogItem}) {
  if(item.thumbnail)return <img loading="lazy" src={item.thumbnail} alt="" referrerPolicy="no-referrer"/>;
  return <div className={'catalog-tile-art art-'+item.kind}>{item.kind==='font'?<><span>Aa</span><Type size={15}/></>:item.kind==='website'?<Globe size={29}/>:item.kind==='video'?<Play size={30}/>:<><span>Make<br/>it move.</span><Sparkles size={17}/></>}</div>;
}
