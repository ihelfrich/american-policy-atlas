import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { number, summarize, relationship, gapScenario, normalPosterior, csv } from '../src/analysis.js';
const rows=JSON.parse(fs.readFileSync(new URL('../public/data/us_counties.min.geojson',import.meta.url))).features.map(f=>f.properties);
test('missing values are excluded, real zero is retained',()=>{
 assert.ok(Number.isNaN(number(null)));
 assert.deepEqual(summarize([{x:null},{x:''},{x:0},{x:2}], 'x'),{n:2,missing:2,mean:1,median:1});
});
test('a known linear relationship fits exactly with paired missingness',()=>{
 const r=relationship([{x:0,y:1},{x:1,y:3},{x:2,y:5},{x:99,y:null}], 'x','y');
 assert.equal(r.n,3);assert.equal(r.excluded,1);assert.equal(r.slope,2);assert.equal(r.intercept,1);assert.equal(r.r,1);
});
test('degenerate and empty scopes have no invented correlation',()=>{
 assert.equal(relationship([], 'x','y').r,null);
 assert.equal(relationship([{x:1,y:2},{x:1,y:3},{x:1,y:4}],'x','y').r,null);
 assert.equal(summarize([], 'x').median,null);
});
test('snapshot coverage matches both source files and missing-state disclosure',()=>{
 assert.equal(rows.length,3144);assert.equal(new Set(rows.map(r=>r.GEOID)).size,3144);
 assert.equal(summarize(rows,'diabetes_pct').n,2956);
 const missing={};for(const r of rows)if(r.diabetes_pct==null)missing[r.state_name]=(missing[r.state_name]||0)+1;
 assert.deepEqual(missing,{Kentucky:120,Pennsylvania:67,Texas:1});
 const summary=JSON.parse(fs.readFileSync(new URL('../public/data/us_summary.json',import.meta.url)));
 for(const [key,s] of Object.entries(summary.varstats)){
  const actual=summarize(rows,key);assert.equal(actual.n,s.n,key);assert.ok(Math.abs(actual.mean-s.mean)<1e-8,key);
 }
});
test('scenario endpoints preserve observed values or close positive gaps, never count cases',()=>{
 const zero=gapScenario(rows,0),full=gapScenario(rows,1);
 assert.equal(zero.reduce((n,b)=>n+b.n,0),2956);
 for(let i=0;i<5;i++){assert.equal(zero[i].observed,zero[i].scenario);assert.ok(full[i].scenario<=full[i].observed);assert.ok(Math.abs(full[i].scenario-Math.min(full[i].observed,full[0].observed))<1e-10);}
 assert.deepEqual(gapScenario([],0.5),[]);
});
test('normal model responds to uncertainty and enforces valid inputs',()=>{
 assert.equal(normalPosterior(20,3,12,3).mean,16);
 assert.equal(normalPosterior(20,0,12,3).mean,20);
 assert.ok(normalPosterior(20,12,12,3).mean<normalPosterior(20,3,12,3).mean);
 assert.throws(()=>normalPosterior(20,-1,12,3));
});
test('CSV quotes delimiters and missing values without zero imputation',()=>{
 assert.equal(csv([{name:'A, "B"',value:null}],['name','value']),'"name","value"\r\n"A, ""B""",""');
});
