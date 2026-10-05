import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fitSpecification,specificationSet,SPECIFICATIONS,stateSensitivity} from '../src/research.js';
const close=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const make=(i,x,y,g='A',w=1)=>({GEOID:String(i),x,y,state_name:g,pop_total:w,median_age:30+(i%3),pop_density_km2:Math.exp(i%4)});
test('within-state fitting recovers a known slope when the pooled sign reverses',()=>{
 const rows=[0,1,2,3,4,5].map(i=>make(i,i,-2*i,'A')).concat([0,1,2,3,4,5].map(i=>make(i+6,i+10,100-2*i,'B')));
 const set=specificationSet(rows,'x','y');
 assert.ok(set.results[0].slope>0);
 close(set.results.find(r=>r.id==='state-county').slope,-2);
});
test('weighted fitting equals explicitly replicated observations',()=>{
 const rows=Array.from({length:12},(_,i)=>make(i,i,2*i+(i%3)*2,'A',1+i%4));
 const weighted=fitSpecification(rows,'x','y',SPECIFICATIONS[4]);
 const replicated=rows.flatMap(r=>Array.from({length:r.pop_total},()=>({...r,pop_total:1})));
 close(weighted.slope,fitSpecification(replicated,'x','y',SPECIFICATIONS[0]).slope);
});
test('adjustment recovers a known coefficient with state offsets and unequal weights',()=>{
 const rows=Array.from({length:80},(_,i)=>{
  const x=(i*7)%19,age=25+(i%7),logDensity=(i*3)%11,g=i<40?'A':'B';
  return {...make(i,x,3*x+2*age-4*logDensity+(g==='A'?25:-15),g,1+i%5),median_age:age,pop_density_km2:Math.exp(logDensity)};
 });
 for(const id of ['state-context-county','state-context-population']){
  const fit=fitSpecification(rows,'x','y',SPECIFICATIONS.find(s=>s.id===id),10);
  close(fit.slope,30);for(const r of fit.points)close(r.residual,0,1e-8);
 }
});
test('shared sample excludes missing controls even from the pooled fit',()=>{
 const rows=Array.from({length:12},(_,i)=>make(i,i,i*i));rows[0].median_age=null;rows[1].pop_total=0;rows[2].pop_density_km2=0;
 const set=specificationSet(rows,'x','y');assert.equal(set.excluded,3);
 for(const fit of set.results)assert.equal(fit.n,9);
});
test('an exposure explained by the controls is not assigned an invented slope',()=>{
 const rows=Array.from({length:12},(_,i)=>({...make(i,i,i*i),median_age:i}));
 assert.equal(fitSpecification(rows,'x','y',SPECIFICATIONS[2]).slope,null);
});
test('CDC supplement reproduces every existing crude value and contains valid paired intervals',()=>{
 const raw=JSON.parse(fs.readFileSync(new URL('../public/data/us_counties.min.geojson',import.meta.url))).features.map(f=>f.properties);
 const data=JSON.parse(fs.readFileSync(new URL('../public/data/diabetes_evidence.json',import.meta.url)));
 assert.equal(data.survey_year,2023);assert.equal(data.matched_existing,2956);
 for(const r of raw){if(r.diabetes_pct==null)continue;const entry=data.county[r.GEOID];assert.equal(entry.crude.estimate,r.diabetes_pct);
  for(const k of ['crude','adjusted']){const d=entry[k];assert.ok(d.low<=d.estimate&&d.estimate<=d.high);assert.ok(d.low>=0&&d.high<=100);}
 }
 assert.equal(data.county['48301'].adult_population,30);assert.equal(data.county['48301'].crude,null);
});
test('all 32 shipped fits reproduce independently generated base-R regression results',()=>{
 const rows=JSON.parse(fs.readFileSync(new URL('../public/data/us_counties.min.geojson',import.meta.url))).features.map(f=>f.properties);
 const data=JSON.parse(fs.readFileSync(new URL('../public/data/diabetes_evidence.json',import.meta.url)));
 rows.forEach(r=>r.diabetes_adjusted=data.county[r.GEOID]?.adjusted?.estimate);
 const reference=fs.readFileSync(new URL('fixtures/r-reference.csv',import.meta.url),'utf8').trim().split('\n').slice(1);
 assert.equal(reference.length,32);
 for(const line of reference){
  const[y,id,n,b,e,h,rmse,deletion,ca]=line.replaceAll('"','').split(',');
  const x=y==='pct_broadband'?'pct_poverty':'median_hh_income',step=y==='pct_broadband'?10:10000;
  const set=specificationSet(rows,x,y,step),result=set.results.find(f=>f.id===id);
  assert.equal(result.n,+n);close(result.slope,+b);close(result.points[0].residual,+e);
  close(result.points[0].leverage,+h);close(result.rmse,+rmse);close(result.points[0].deletionChange,+deletion);
  close(fitSpecification(set.sample.filter(r=>r.state_name!=='California'),x,y,result,step).slope,+ca);
 }
});
test('hat diagonals sum to fitted rank and partial regression recovers the coefficient',()=>{
 const rows=Array.from({length:40},(_,i)=>make(i,(i*7)%13,i*i+(i%3),i<20?'A':'B',1+i%4));
 const fit=fitSpecification(rows,'x','y',SPECIFICATIONS[7]);
 close(fit.points.reduce((s,r)=>s+r.leverage,0),fit.rank);
 const xx=fit.points.reduce((s,r)=>s+r.pop_total*r.partialX**2,0);
 const xy=fit.points.reduce((s,r)=>s+r.pop_total*r.partialX*r.partialY,0);
 close(xy/xx,fit.beta);
 assert.ok(fit.points.every(r=>r.leverage>=0&&r.leverage<=1+1e-10));
});
test('state deletions retain the common-sample rule and recover known within-state slopes',()=>{
 const rows=Array.from({length:24},(_,i)=>make(i,i%8,3*(i%8)+Math.floor(i/8)*20,['A','B','C'][Math.floor(i/8)]));
 rows.push({...make(25,200,600,'A'),median_age:null});
 const result=stateSensitivity(rows,'x','y',SPECIFICATIONS[1]);
 assert.equal(result.omitted.length,3);close(result.baseline,3);
 for(const r of result.omitted){assert.equal(r.n,16);assert.equal(r.removed,8);close(r.slope,3);close(r.change,0);}
});
