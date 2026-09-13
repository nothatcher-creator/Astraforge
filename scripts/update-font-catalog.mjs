// Maintenance command; normal builds use the checked-in, verified catalog.
import {mkdir,writeFile} from 'node:fs/promises';
const list=[['Bebas Neue','bebasneue','Bold titles'],['Oswald','oswald','Rock'],['Anton','anton','Heavy titles'],['Archivo Black','archivoblack','Hip-hop'],['Bangers','bangers','Comic'],['Cinzel','cinzel','Cinematic'],['Orbitron','orbitron','Synthwave'],['Rajdhani','rajdhani','Electronic'],['Teko','teko','Metal'],['Kalam','kalam','Handwritten'],['Caveat','caveat','Acoustic'],['Dancing Script','dancingscript','Love song'],['Lobster','lobster','Retro'],['Lora','lora','Indie'],['Montserrat','montserrat','Pop'],['Playfair Display','playfairdisplay','Elegant'],['Space Grotesk','spacegrotesk','Modern'],['Courier Prime','courierprime','Vintage'],['Rubik','rubik','Clean'],['Press Start 2P','pressstart2p','Pixel']];
const items=[];
await mkdir('lib/lyricforge/catalog',{recursive:true});
for(const [title,slug,mood] of list) {
  const response=await fetch('https://api.github.com/repos/google/fonts/contents/ofl/'+slug,{headers:{'User-Agent':'LyricForge-catalog'}});
  if(!response.ok)throw new Error(title+': '+response.status);
  const files=await response.json();
  const choices=files.filter(f=>f.name.endsWith('.ttf')&&!f.name.includes('Italic'));
  const file=choices.find(f=>f.name.includes('Regular'))||choices[0];
  const license=files.find(f=>f.name==='OFL.txt');
  if(!file||!license)throw new Error('Missing font or license: '+title);
  items.push({id:'google-'+slug,kind:'font',title,provider:'Google Fonts',description:mood+' · editable project font',tags:[mood.toLowerCase(),title.toLowerCase()],sourceUrl:'https://fonts.google.com/specimen/'+title.replaceAll(' ','+'),license:'SIL Open Font License 1.1',licenseUrl:license.download_url,creator:title+' font contributors',downloadUrl:file.download_url,filename:file.name,mime:'font/ttf',size:file.size});
  await writeFile('lib/lyricforge/catalog/fonts.json',JSON.stringify(items,null,2)+'\n');
}
await mkdir('lib/lyricforge/catalog',{recursive:true});
await writeFile('lib/lyricforge/catalog/fonts.json',JSON.stringify(items,null,2)+'\n');
console.log('Verified '+items.length+' font files and licenses.');
