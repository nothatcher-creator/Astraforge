import type {CatalogItem} from '../catalog';
import {parseCatalog} from '../catalog';
import fonts from './fonts.json';

const motions:CatalogItem[]=[
  ['fade-up','Fade up','Rise','None','Fade'],['fade-down','Fade down','Fall','None','Fade'],
  ['bounce-in','Bounce in','Bounce','None','Fade'],['zoom-in','Zoom in','Zoom','None','Fade'],
  ['slide-in','Slide in','Slide','None','Slide'],['soft-pop','Soft pop','Pop','None','Fade'],
  ['stretch-in','Stretch in','Stretch','None','Fade'],['rotate-in','Rotate in','Spin','None','Fade'],
  ['pulse','Pulse','Fade','Pulse','Fade'],['shake','Shake','Fade','Shake','Fade'],
].map(([id,title,entrance,idle,exit])=>({id:'motion-'+id,kind:'animation',title,provider:'Animate.css · adapted',creator:'LyricForge canvas adaptation',license:'MIT source inspiration',licenseUrl:'https://github.com/animate-css/animate.css/blob/main/LICENSE',sourceUrl:'https://animate.style/',description:'An editable canvas adaptation inspired by Animate.css. The preview uses the same renderer as your exported video.',tags:['text','motion',id],recipe:{entrance,idle,exit,animationDuration:650,intensity:.8,easing:'ease-out'}} as CatalogItem));
const transitions:CatalogItem[]=[
  {id:'soft-dissolve',title:'Soft dissolve',recipe:{entrance:'Fade',exit:'Fade',animationDuration:700}},
  {id:'slide-through',title:'Slide through',recipe:{entrance:'Slide',exit:'Slide',animationDuration:450,direction:1}},
  {id:'blur-dissolve',title:'Blur dissolve',recipe:{entrance:'Blur In',exit:'Blur Out',animationDuration:800}},
  {id:'cinematic-rise',title:'Cinematic rise',recipe:{entrance:'Rise',exit:'Fade',animationDuration:1000}},
].map(item=>({...item,id:'transition-'+item.id,kind:'transition',provider:'LyricForge',creator:'LyricForge',license:'Included with the editor',sourceUrl:'https://github.com/nothatcher-creator/Astraforge',description:'A paired entrance and exit for lyric or title layers. Adjust duration, direction and intensity afterward.',tags:['text','transition']} as CatalogItem));
export const WEBSITES:CatalogItem[]=[
  {id:'mixkit',title:'Mixkit video & overlays',sourceUrl:'https://mixkit.co/free-stock-video/',description:'Browse footage and animated backgrounds. Download an MP4 on Mixkit, then import it into your project.',tags:['video','background','overlays']},
  {id:'mixkit-templates',title:'Mixkit motion templates',sourceUrl:'https://mixkit.co/free-after-effects-templates/',description:'Browse effects and transitions. After Effects templates require After Effects; rendered MP4/WebM files can be imported here.',tags:['effects','transition','templates']},
  {id:'pexels',title:'Pexels videos',sourceUrl:'https://www.pexels.com/videos/',description:'Browse stock footage on Pexels, download a video, then import it here.',tags:['video','nature','background']},
  {id:'pixabay',title:'Pixabay videos',sourceUrl:'https://pixabay.com/videos/',description:'Browse motion backgrounds and stock footage. Check each download’s terms on the source page.',tags:['video','effects','background']},
  {id:'google-fonts',title:'Google Fonts library',sourceUrl:'https://fonts.google.com/',description:'Explore the complete library. Download additional TTF/OTF fonts and import them into Project Fonts.',tags:['font','typography']},
  {id:'animate-css',title:'Animate.css reference',sourceUrl:'https://animate.style/',description:'Browse the original CSS animation library. Compatible canvas adaptations are available in the Effects tab here.',tags:['effects','text','animation']},
].map(i=>({...i,kind:'website',provider:'External website',creator:'See source',license:'Check source terms'} as CatalogItem));
export const CURATED=parseCatalog({version:1,items:[...fonts,...motions,...transitions,...WEBSITES]});
