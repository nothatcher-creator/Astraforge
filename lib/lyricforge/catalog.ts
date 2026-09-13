import {z} from 'zod';
import {ANIMATIONS,type Project,type Style} from './model';

export const onlineUrl=z.string().max(3000).url().refine(value=>{
  const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname.includes('.')&&!/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname)&&!u.hostname.endsWith('.local');
},'Use a public HTTPS URL without credentials.');
const animation=z.enum(ANIMATIONS as [typeof ANIMATIONS[number],...typeof ANIMATIONS[number][]]);
const recipe=z.object({entrance:animation.optional(),idle:animation.optional(),exit:animation.optional(),emphasis:animation.optional(),animationDuration:z.number().min(50).max(10000).optional(),intensity:z.number().min(0).max(2).optional(),delay:z.number().min(0).max(10000).optional(),direction:z.number().min(-1).max(1).optional(),easing:z.enum(['linear','ease-in','ease-out','ease-in-out']).optional(),glow:z.number().min(0).max(100).optional()}).strict();
const extensions:Record<string,RegExp>={
  'image/jpeg':/\.jpe?g$/i,'image/png':/\.png$/i,'image/webp':/\.webp$/i,'image/gif':/\.gif$/i,
  'video/mp4':/\.mp4$/i,'video/webm':/\.webm$/i,'video/quicktime':/\.mov$/i,
  'font/ttf':/\.ttf$/i,'font/otf':/\.otf$/i,'font/woff':/\.woff$/i,'font/woff2':/\.woff2$/i,
};
const itemSchema=z.object({
  id:z.string().min(1).max(160),kind:z.enum(['image','video','font','animation','transition','website']),
  title:z.string().min(1).max(300),provider:z.string().max(100),description:z.string().max(2000).default(''),
  tags:z.array(z.string().max(60)).max(30).default([]),sourceUrl:onlineUrl,creator:z.string().max(1000),license:z.string().max(200),licenseUrl:onlineUrl.optional(),
  thumbnail:onlineUrl.optional(),downloadUrl:onlineUrl.optional(),filename:z.string().max(200).regex(/^[^/\\\u0000]+\.(jpe?g|png|webp|gif|mp4|webm|mov|ttf|otf|woff2?)$/i).optional(),
  mime:z.enum(['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','font/ttf','font/otf','font/woff','font/woff2']).optional(),
  size:z.number().finite().min(0).max(2e9).optional(),width:z.number().min(0).optional(),height:z.number().min(0).optional(),recipe:recipe.optional(),
}).refine(i=>i.kind==='website'||((i.kind==='animation'||i.kind==='transition')?!!i.recipe:!!i.downloadUrl&&!!i.filename&&!!i.mime),'Catalog item is missing import or effect information.')
  .refine(i=>!['image','video','font'].includes(i.kind)||!!(i.mime?.startsWith(i.kind+'/')&&extensions[i.mime]?.test(i.filename||'')),'The asset kind, MIME type and filename must match.');
export type CatalogItem=z.infer<typeof itemSchema>;
export type CatalogScope='lyrics'|'selection';
export function parseCatalog(data:unknown):CatalogItem[] {
  const parsed=z.object({version:z.literal(1),items:z.array(itemSchema).max(500)}).safeParse(data);
  if(!parsed.success)throw new Error('Invalid catalog: '+parsed.error.issues[0].message);
  const items=parsed.data.items;
  if(new Set(items.map(i=>i.id)).size!==items.length)throw new Error('Invalid catalog: duplicate item IDs.');
  return items;
}
export function plainText(value:unknown) {
  return String(value??'').replace(/<[^>]*>/g,'').replace(/&(?:amp|quot|apos|lt|gt|#39);/g,v=>({'&amp;':'&','&quot;':'"','&apos;':"'",'&#39;':"'",'&lt;':'<','&gt;':'>'}[v]||v)).slice(0,1000);
}
export function parseCommons(data:unknown):{items:CatalogItem[];next?:number} {
  const root=data as {error?:{info:string};continue?:{gsroffset:number};query?:{pages?:unknown[]}};
  if(root.error)throw new Error(root.error.info);
  const items:CatalogItem[]=[];
  for(const raw of root.query?.pages||[]) {
    const page=raw as {pageid:number;title:string;imageinfo?:{url:string;thumburl?:string;descriptionurl:string;mime:string;size:number;width:number;height:number;extmetadata?:Record<string,{value:unknown}>}[]};
    const media=page.imageinfo?.[0];if(!media)continue;
    const kind=media.mime.startsWith('video/')?'video':'image';
    const meta=media.extmetadata||{};
    const candidate=itemSchema.safeParse({id:'commons-'+page.pageid,kind,title:page.title.replace(/^File:/,''),provider:'Wikimedia Commons',description:plainText(meta.ImageDescription?.value),creator:plainText(meta.Artist?.value)||'See source credits',license:plainText(meta.LicenseShortName?.value)||'See source license',...(onlineUrl.safeParse(meta.LicenseUrl?.value).success?{licenseUrl:meta.LicenseUrl.value}:{}),sourceUrl:media.descriptionurl,downloadUrl:media.url,thumbnail:media.thumburl,mime:media.mime,filename:page.title.replace(/^File:/,'').replace(/[/\\]/g,'-').slice(-200),size:media.size,width:media.width,height:media.height});
    if(candidate.success)items.push(candidate.data);
  }
  return {items,next:root.continue?.gsroffset};
}
export async function searchCommons(query:string,kind:'image'|'video',offset:number,signal:AbortSignal) {
  const params=new URLSearchParams({action:'query',generator:'search',gsrsearch:`${query.trim()||'nature'} filetype:${kind==='video'?'video':'bitmap'}`,gsrnamespace:'6',gsrlimit:'12',gsroffset:String(offset),prop:'imageinfo',iiprop:'url|size|mime|extmetadata',iiextmetadatafilter:'Artist|LicenseShortName|LicenseUrl|ImageDescription',iiurlwidth:'500',format:'json',formatversion:'2',origin:'*'});
  const response=await fetch('https://commons.wikimedia.org/w/api.php?'+params,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw new Error(`Wikimedia returned ${response.status}. Try again shortly.`);
  return parseCommons(await response.json());
}
async function limitedBytes(response:Response,max:number,onProgress:(percent:number)=>void,signal:AbortSignal) {
  if(!response.ok)throw new Error(`Download returned ${response.status}. Open the source page to check availability.`);
  const expected=Number(response.headers.get('content-length'))||0;
  if(expected>max)throw new Error('This download is too large for the catalog. Download it from its source and import a smaller file.');
  const reader=response.body?.getReader();if(!reader)throw new Error('The source returned an empty response.');
  const parts:Uint8Array[]=[];let total=0;
  try{while(true){signal.throwIfAborted();const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max)throw new Error('This download is too large for the catalog.');parts.push(value);onProgress(expected?Math.min(99,total/expected*100):0);}}catch(error){await reader.cancel();throw error;}finally{reader.releaseLock();}
  if(!total)throw new Error('The source returned an empty file.');
  onProgress(100);return new Blob(parts as BlobPart[]);
}
export async function downloadCatalogFile(item:CatalogItem,signal:AbortSignal,onProgress:(p:number)=>void,fetcher:typeof fetch=fetch):Promise<File> {
  if(!item.downloadUrl||!item.filename||!item.mime)throw new Error('This item opens on its source website.');
  onlineUrl.parse(item.downloadUrl);
  const response=await fetcher(item.downloadUrl,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
  const type=(response.headers.get('content-type')||'').split(';')[0];
  const accepted=type===item.mime||type==='application/octet-stream'||type==='application/x-font-ttf'||type==='application/font-sfnt';
  if(!accepted)throw new Error(`The source returned an unsupported file type (${type||'unknown'}). Open its source page to download the original.`);
  const blob=await limitedBytes(response,item.kind==='font'?12e6:item.kind==='image'?60e6:150e6,onProgress,signal);
  return new File([blob],item.filename,{type:item.mime});
}
export async function fetchCatalog(url:string,signal:AbortSignal) {
  onlineUrl.parse(url);
  const response=await fetch(url,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
  const blob=await limitedBytes(response,2e6,()=>{},signal);
  return parseCatalog(JSON.parse(await blob.text()));
}
export function applyCatalogStyle(project:Project,selected:string[],patch:Partial<Style>,scope:CatalogScope):Project {
  const ids=new Set(project.clips.filter(c=>(scope==='lyrics'?c.kind==='lyrics':selected.includes(c.id)&&(c.kind==='text'||c.kind==='lyrics'))&&!project.tracks.find(t=>t.id===c.trackId)?.locked).map(c=>c.id));
  if(!ids.size&&(scope==='selection'||project.clips.some(c=>c.kind==='lyrics')))return project;
  const updatesDefault=scope==='lyrics';
  return {
    ...project,
    ...(updatesDefault?{lyricStyle:{...project.lyricStyle,...patch}}:{}),
    clips:project.clips.map(c=>{
      if(ids.has(c.id))return {...c,style:{...c.style,...patch}};
      if(!updatesDefault)return c;
      // Preserve inherited properties on every layer outside the requested scope.
      // Future lyric lines can still inherit the new project default.
      const preserved=Object.fromEntries(Object.keys(patch).map(key=>[key,c.style[key as keyof Style]??project.lyricStyle[key as keyof Style]]));
      return {...c,style:{...c.style,...preserved}};
    }),
  };
}
