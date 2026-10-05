import {stateSensitivity} from './research.js';
let rows=[];
self.onmessage=({data})=>{
  if(data.type==='init'){rows=data.rows;return;}
  if(data.type==='sensitivity'){
    try{self.postMessage({id:data.id,result:stateSensitivity(rows,data.x,data.y,data.spec,data.step)});}
    catch(error){self.postMessage({id:data.id,error:error.message});}
  }
};
