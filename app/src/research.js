// Weighted Frisch–Waugh–Lovell regressions on a common, explicit sample.
// These are descriptive specifications, not causal effect estimates.
import {finite,number,mean} from './analysis.js';

export const SPECIFICATIONS = ['county','population'].flatMap(weight => [
  {id:`pooled-${weight}`,label:'All counties together',within:false,adjust:false,weight},
  {id:`state-${weight}`,label:'Within the same state',within:true,adjust:false,weight},
  {id:`context-${weight}`,label:'Age + density adjustment',within:false,adjust:true,weight},
  {id:`state-context-${weight}`,label:'Within state + age + density',within:true,adjust:true,weight},
]);
const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
export function commonSample(rows,x,y) {
  return rows.filter(r=>[x,y,'median_age','pop_density_km2','pop_total'].every(k=>finite(r[k])) && number(r.pop_density_km2)>0 && number(r.pop_total)>0 && r.state_name);
}

export function fitSpecification(rows,x,y,spec,step=1) {
  if (rows.length < 5) return {id:spec.id,slope:null,reason:'Fewer than five complete counties',points:[],n:rows.length};
  const weights=rows.map(r=>spec.weight==='population'?number(r.pop_total):1);
  const scale=mean(weights), w=weights.map(v=>v/scale), sw=w.map(Math.sqrt);
  const groups=rows.map(r=>spec.within?r.state_name:'all');
  const groupIds=[...new Set(groups)];
  const center = values => {
    const sums=new Map(groupIds.map(g=>[g,[0,0]]));
    values.forEach((v,i)=>{const s=sums.get(groups[i]);s[0]+=w[i]*v;s[1]+=w[i];});
    return values.map((v,i)=>(v-sums.get(groups[i])[0]/sums.get(groups[i])[1])*sw[i]);
  };
  const rawX=rows.map(r=>number(r[x])), rawY=rows.map(r=>number(r[y]));
  let rx=center(rawX),ry=center(rawY);
  const controls=spec.adjust?[rows.map(r=>number(r.median_age)),rows.map(r=>Math.log(number(r.pop_density_km2)))]:[];
  const basis=[];
  for(const column of controls) {
    let v=center(column), originalNorm=Math.sqrt(dot(v,v));
    // Two modified Gram–Schmidt passes limit loss of orthogonality.
    for(let pass=0;pass<2;pass++)for(const q of basis){const c=dot(v,q);v=v.map((a,i)=>a-c*q[i]);}
    const norm=Math.sqrt(dot(v,v));
    if(norm>1e-10*Math.max(1,originalNorm))basis.push(v.map(a=>a/norm));
  }
  for(const q of basis){const a=dot(rx,q),b=dot(ry,q);rx=rx.map((v,i)=>v-a*q[i]);ry=ry.map((v,i)=>v-b*q[i]);}
  const xx=dot(rx,rx), centeredX=center(rawX);
  const rank=groupIds.length+basis.length+1;
  if(rows.length<=rank || xx<=1e-12*Math.max(1,dot(centeredX,centeredX)))return {id:spec.id,slope:null,reason:'Insufficient independent variation in the exposure',points:[],n:rows.length};
  const beta=dot(rx,ry)/xx;
  const points=rows.map((r,i)=>({...r,residual:(ry[i]-beta*rx[i])/sw[i],fitted:rawY[i]-(ry[i]-beta*rx[i])/sw[i]}));
  return {id:spec.id,slope:beta*step,beta,points,n:rows.length,rank,weight:spec.weight,within:spec.within,adjust:spec.adjust};
}

export function specificationSet(rows,x,y,step=1) {
  const sample=commonSample(rows,x,y);
  return {sample,excluded:rows.length-sample.length,results:SPECIFICATIONS.map(s=>({...s,...fitSpecification(sample,x,y,s,step)}))};
}

export function estimateDirection(value) {
  return value==null?'unavailable':Math.abs(value)<0.05?'little':value<0?'lower':'higher';
}
