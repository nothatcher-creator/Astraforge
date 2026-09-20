import {alignExistingLyrics} from './alignment';
self.onmessage=({data})=>{
 try{self.postMessage({report:alignExistingLyrics(data.project,data.words,data.options)});}
 catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}
};
