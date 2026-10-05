// Independent base-R reference. Run from repo root; Rscript must be installed.
// `node scripts/validate_research.mjs --update` also regenerates the test fixture.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {csv} from '../app/src/analysis.js';
import {specificationSet} from '../app/src/research.js';
const rows=JSON.parse(fs.readFileSync('app/public/data/us_counties.min.geojson')).features.map(f=>f.properties);
const data=JSON.parse(fs.readFileSync('app/public/data/diabetes_evidence.json'));
rows.forEach(r=>r.diabetes_adjusted=data.county[r.GEOID]?.adjusted?.estimate);
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-validation-'));
try {
  const input=path.join(scratch,'input.csv'),output=path.join(scratch,'reference.csv');
  fs.writeFileSync(input,csv(rows,['GEOID','state_name','median_hh_income','pct_poverty','diabetes_pct','diabetes_adjusted','rent_burden_pct','pct_broadband','median_age','pop_density_km2','pop_total']));
  const run=spawnSync('Rscript',['scripts/validate_research.R',input,output],{encoding:'utf8',timeout:30000});
  if(run.status!==0)throw new Error(run.stderr||run.error?.message||'R reference failed');
  const reference=fs.readFileSync(output,'utf8');
  let maxSlopeDifference=0,maxResidualDifference=0;
  for(const line of reference.trim().split('\n').slice(1)){
    const [y,id,n,b,e]=line.replaceAll('"','').split(',');
    const result=specificationSet(rows,y==='pct_broadband'?'pct_poverty':'median_hh_income',y,y==='pct_broadband'?10:10000).results.find(f=>f.id===id);
    if(result.n!==+n)throw new Error('Common sample mismatch');
    maxSlopeDifference=Math.max(maxSlopeDifference,Math.abs(result.slope-Number(b)));
    maxResidualDifference=Math.max(maxResidualDifference,Math.abs(result.points[0].residual-Number(e)));
  }
  if(maxSlopeDifference>1e-9||maxResidualDifference>1e-9)throw new Error('R reference mismatch');
  if(process.argv.includes('--update'))fs.writeFileSync('app/tests/fixtures/r-reference.csv',reference);
  console.log({fits:32,maxSlopeDifference,maxResidualDifference});
} finally {fs.rmSync(scratch,{recursive:true,force:true});}
