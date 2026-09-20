import {spawnSync} from 'node:child_process';
import {rm} from 'node:fs/promises';
import {buildSync} from 'esbuild';
const dir=new URL('../tests/.compiled/',import.meta.url);
buildSync({entryPoints:[...['model','lyrics','history','animation','synchronization','store','timeline-geometry','catalog','catalog/curated','public-url'].map(n=>`lib/lyricforge/${n}.ts`),'tests/project-entry.ts'],outdir:dir.pathname,outbase:'.',entryNames:'[name]',bundle:true,packages:'external',platform:'node',format:'esm',outExtension:{'.js':'.mjs'}});
try {const result=spawnSync(process.execPath,['--test','tests/core.test.mjs','tests/project.test.mjs','tests/catalog.test.mjs','tests/alignment.test.mjs'],{stdio:'inherit'});process.exitCode=result.status??1;} finally {await rm(dir,{recursive:true,force:true});}
