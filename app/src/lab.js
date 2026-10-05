import {state,loadJSON} from './data.js';
import {number,csv} from './analysis.js';
import {drawCountyMap} from './investigate.js';
import {specificationSet,estimateDirection} from './research.js';
import {STUDIES,labTemplate} from './lab-content.js';
import {animateEntrance,drawPartialPlot,scatterDomains,drawIntervals,sensitivityChart,signed} from './lab-charts.js';

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function saveFile(text,name,type) {
  const url=URL.createObjectURL(new Blob([text],{type}));
  const dialog=document.createElement('dialog');dialog.className='lab-export-dialog';
  dialog.innerHTML=`<h2>Your research export</h2><p>${esc(name)}</p><label for="export-preview">Review or copy the complete file</label><textarea id="export-preview" rows="12" readonly></textarea><div><a href="${url}" download="${esc(name)}">Download file</a><button type="button" data-copy>Copy contents</button><button type="button" data-close>Close</button></div><p role="status"></p>`;
  dialog.querySelector('textarea').value=text;
  dialog.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(text);dialog.querySelector('[role=status]').textContent='Copied.';}catch{dialog.querySelector('[role=status]').textContent='Select and copy the text above.';}};
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.onclose=()=>{URL.revokeObjectURL(url);dialog.remove();};
  document.body.append(dialog);dialog.showModal();
}

export async function mountLab() {
  const el=document.getElementById('evidence-lab');
  el.innerHTML='<p class="loading-message">Preparing the evidence laboratory…</p>';
  let supplement;
  try{supplement=await loadJSON('diabetes_evidence.json');}catch{el.innerHTML='<p class="loading-message">The research supplement could not load. Please reload, or <a href="#/investigate">open the original investigations</a>.</p>';return;}
  if(!el.isConnected)return;
  const raw=state.counties.features.map(f=>f.properties);
  const rows=raw.map(r=>({...r,diabetes_adjusted:supplement.county[r.GEOID]?.adjusted?.estimate??null}));
  const query=new URLSearchParams(location.hash.split('?')[1]||'');
  let study=STUDIES.find(s=>s.id===query.get('q'))||STUDIES[0];
  let measure=query.get('measure')==='adjusted'?'adjusted':'crude';
  let chosen=query.get('spec')||'pooled-county';
  let selected=rows.some(r=>r.GEOID===query.get('county'))?query.get('county'):'29510';
  let revealed=true,prediction='',results,sample,outcome,domains,mapBreaks,previous=null;
  let worker,workerRequest=0,activeSensitivityKey='',diagnosticResults=null;
  const sensitivityCache=new Map();
  el.innerHTML=labTemplate();
  const get=id=>el.querySelector('#'+id);
  function countyOptions(){const term=get('lab-search').value.toLowerCase();get('lab-county').innerHTML=rows.filter(r=>r.GEOID===selected||`${r.county_name} ${r.state_name}`.toLowerCase().includes(term)).sort((a,b)=>a.county_name.localeCompare(b.county_name)||a.state_name.localeCompare(b.state_name)).map(r=>`<option value="${r.GEOID}">${esc(r.county_name)}, ${esc(r.state_name)}</option>`).join('');get('lab-county').value=selected;}
  function current(){return results.find(r=>r.id===chosen);}
  function updateURL(){history.replaceState(null,'',`#/lab?${new URLSearchParams({q:study.id,measure,spec:chosen,county:selected,show:revealed?'1':'0'})}`);}
  function selectPlace(id){selected=id;countyOptions();renderChoice();updateURL();}
  function renderSensitivity(result){
    diagnosticResults=result;
    get('lab-sensitivity').setAttribute('aria-busy','false');
    sensitivityChart(get('lab-sensitivity'),result);
    const valid=result.omitted.filter(r=>r.slope!=null);
    const sorted=[...valid].sort((a,b)=>Math.abs(b.change)-Math.abs(a.change));
    const slopes=valid.map(r=>r.slope);
    get('lab-sensitivity-note').textContent=valid.length?`${valid.length} estimable refits. Associations range from ${signed(Math.min(...slopes))} to ${signed(Math.max(...slopes))} pp when one state is omitted. Dots are stacked vertically for legibility.`:'No state-deletion fits are estimable.';
    get('lab-state-influence').innerHTML='<div class="influence-table-head"><span>Largest changes · omitted state</span><span>Δ association</span></div>'+sorted.slice(0,3).map(r=>`<div><span>${esc(r.state)}<small>${r.removed} counties removed</small></span><b>${signed(r.change)} pp</b></div>`).join('');
  }
  function requestSensitivity(){
    const key=`${study.id}:${measure}:${chosen}`;
    if(key===activeSensitivityKey)return;
    activeSensitivityKey=key;diagnosticResults=null;
    const id=++workerRequest;
    if(sensitivityCache.has(key)){renderSensitivity(sensitivityCache.get(key));return;}
    get('lab-sensitivity').innerHTML='<div class="diagnostic-pending"><span></span>Refitting across states…</div>';
    get('lab-sensitivity').setAttribute('aria-busy','true');
    get('lab-state-influence').replaceChildren();get('lab-sensitivity-note').textContent='';
    const {within,adjust,weight}=current();
    if(worker)worker.postMessage({type:'sensitivity',id,x:study.x,y:study.id==='health'&&measure==='adjusted'?'diabetes_adjusted':study.y,step:study.step,spec:{id:chosen,within,adjust,weight}});
    else {get('lab-sensitivity').textContent='State-deletion diagnostics are unavailable in this browser.';get('lab-sensitivity').setAttribute('aria-busy','false');}
  }
  function renderChoice(){
    const fit=current();
    get('lab-model-name').textContent=`${fit.label} · ${fit.weight==='county'?'Equal county weights':'Population weights'}`;
    const valueChanged=get('lab-value').textContent!==signed(fit.slope);
    get('lab-value').textContent=signed(fit.slope);
    get('lab-estimate-caption').textContent=`${outcome} associated with ${study.exposure}.` ;
    get('lab-fit-metrics').innerHTML=`<div><strong>${fit.rmse.toFixed(2)} pp</strong><span>In-sample weighted RMSE</span></div><div><strong>${fit.n.toLocaleString()}</strong><span>County observations</span></div>`;
    get('lab-shift').textContent=previous&&previous.id!==fit.id?`${signed(fit.slope-previous.slope)} pp from the previous specification`:'County-level association; no causal effect identified.';
    if(valueChanged)animateEntrance(get('lab-value'));
    drawPartialPlot(get('lab-partial'),fit,domains,study.step,selected,selectPlace);
    get('lab-partial-tag').textContent=fit.weight==='county'?'Equal county weights':'Population weights';
    requestSensitivity();
    get('lab-model-select').value=chosen;
    el.querySelectorAll('[data-spec]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.spec===chosen)));
    const breaks=drawCountyMap(get('lab-map'),study.y,selected,selectPlace,'all',{values:new Map(fit.points.map(r=>[r.GEOID,r.residual])),label:'difference from the selected fitted value',breaks:mapBreaks});
    get('lab-map-note').textContent='Observed minus fitted outcome, in percentage points. Color thresholds stay fixed across all eight models for this outcome. Gray counties are outside the common sample. Alaska and Hawaii are inset.';
    get('lab-map-legend').innerHTML=[['#27687a',`Below −${breaks[3].toFixed(1)}`],['#99c4cb',`−${breaks[3].toFixed(1)} to −${breaks[2].toFixed(1)}`],['#f0f0df',`Within ±${breaks[2].toFixed(1)}`],['#ddb47a',`${breaks[2].toFixed(1)} to ${breaks[3].toFixed(1)}`],['#ab582d',`Above ${breaks[3].toFixed(1)}`]].map(([color,label])=>`<span><i style="background:${color}"></i>${label}</span>`).join('');
    const extremes=[...fit.points].sort((a,b)=>Math.abs(b.residual)-Math.abs(a.residual)||a.GEOID.localeCompare(b.GEOID)).slice(0,3);
    get('lab-outliers').innerHTML=extremes.map(r=>`<button data-place="${r.GEOID}"><span>${esc(r.county_name)}, ${esc(r.state_name)}</span><strong>${signed(r.residual)} pp</strong></button>`).join('');
    get('lab-outliers').querySelectorAll('button').forEach(b=>b.onclick=()=>selectPlace(b.dataset.place));
    const row=rows.find(r=>r.GEOID===selected),p=fit.points.find(r=>r.GEOID===selected);
    get('lab-selected-place').textContent=`${row.county_name}, ${row.state_name} · Inspect county ↓`;
    get('lab-place-detail').innerHTML=`<h3>${esc(row.county_name)}</h3><p>${esc(row.state_name)} · FIPS ${selected}</p>${p?`
      <div class="place-numbers"><div><strong>${number(p[study.id==='health'&&measure==='adjusted'?'diabetes_adjusted':study.y]).toFixed(1)}%</strong><span>Observed estimate</span></div><div><strong>${p.fitted.toFixed(1)}%</strong><span>Model fit</span></div><div><strong>${signed(p.residual)}</strong><span>Residual · pp</span></div></div>
      <div class="county-influence"><span>Change in association if this county is omitted</span><strong>${p.deletionChange==null?'Not estimable':signed(p.deletionChange)+' pp'}</strong></div>
      <p class="figure-caption">Hat value: ${p.leverage.toFixed(4)}. Residual size and coefficient influence describe different features of the fit. Linear fitted values are unconstrained and may fall outside 0–100.</p>`:
      '<p class="figure-caption">This county is outside the common sample. A fitted value and influence diagnostic are unavailable.</p>'}
      <a href="#/investigate?q=${study.id}&county=${selected}">Open the county comparison →</a>`;
    const evidence=supplement.county[selected];
    if(study.id==='health'&&evidence?.crude&&evidence?.adjusted){
      get('lab-interval').innerHTML='<h3>Crude and age-adjusted prevalence.</h3><p>CDC estimates for the selected county, with model-based 95% confidence intervals.</p><div id="lab-county-ci"></div><p class="figure-caption">Age standardization changes the population comparison. It is distinct from adding county median age to a regression. The two estimates are correlated; overlapping intervals do not test their difference.</p>';
      drawIntervals(get('lab-county-ci'),evidence,row.county_name);
    }else {
      const reason=study.id==='health'?
        (['Kentucky','Pennsylvania'].includes(row.state_name)?'CDC did not publish the relevant 2023 BRFSS-based estimates for this state.':selected==='48301'?'CDC reports 30 adults in Loving County, below its reporting minimum of 50.':'The supplement does not contain paired crude and age-adjusted estimates for this county.'):
        'These ACS values summarize five years of survey responses. Their margins of error are not included in this dataset, so the displayed differences do not incorporate sampling uncertainty.';
      get('lab-interval').innerHTML=`<h3>${study.id==='health'?'Why this estimate is unavailable.':'What the estimates measure.'}</h3><p>${reason}</p><p class="figure-caption">${esc(study.measurement)}</p>`;
    }

  }
  function render(){
    const y=study.id==='health'&&measure==='adjusted'?'diabetes_adjusted':study.y;
    outcome=(study.id==='health'&&measure==='adjusted'?'age-adjusted ':'')+study.outcome;
    const set=specificationSet(rows,study.x,y,study.step);results=set.results;sample=set.sample;
    domains=scatterDomains(results,study.step);
    const residuals=results.flatMap(r=>r.points.map(p=>Math.abs(p.residual))).sort((a,b)=>a-b);
    const low=residuals[Math.floor(residuals.length*.4)]||.01,high=Math.max(low+.01,residuals[Math.floor(residuals.length*.8)]||.02);
    mapBreaks=[-high,-low,low,high];
    if(!results.some(r=>r.id===chosen))chosen=results[0].id;
    get('lab-hypothesis').textContent=study.hypothesis;
    get('lab-title').textContent=study.headline;
    get('lab-intro').textContent=study.intro;
    get('lab-exposure').textContent=`${study.exposure} → ${outcome}`;
    get('lab-source-period').textContent=study.id==='health'?'ACS 2018–22 / BRFSS 2023':'ACS 2018–22';
    get('lab-measure').hidden=study.id!=='health';get('lab-outcome').value=measure;
    el.querySelectorAll('[data-study]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.study===study.id)));
    get('lab-results').hidden=!revealed;get('lab-prediction').hidden=revealed;
    const direction=estimateDirection(results.find(r=>r.id==='state-context-county').slope);
    get('lab-prediction-note').textContent=prediction?`Your prediction: ${prediction==='little'?'close to zero':prediction}. The within-state, age-and-density-adjusted estimate with equal county weights is ${direction==='little'?'close to zero':direction}. “Close” means within ±0.05 pp per stated exposure increment; this is a descriptive threshold, not a test.`:'';
    el.querySelectorAll('[data-predict]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.predict===prediction)));
    get('lab-sample').innerHTML=`<strong>${sample.length.toLocaleString()}</strong><span>counties held constant across all eight fits</span><b>${set.excluded}</b><span>excluded for missing measures or nonpositive density/population</span><span class="sample-stamp">ACS 2018–22 ${study.id==='health'?'× BRFSS 2023':''}</span>`;
    const values=results.map(r=>r.slope).filter(v=>v!=null),extent=Math.max(.1,...values.map(Math.abs))*1.15,position=v=>50+v/extent*46;
    get('lab-model-select').innerHTML=['county','population'].map(w=>`<optgroup label="${w==='county'?'Equal county weights':'Population weights'}">${results.filter(r=>r.weight===w).map(r=>`<option value="${r.id}">${esc(r.label)} · ${signed(r.slope)} pp</option>`).join('')}</optgroup>`).join('');
    get('lab-axis').innerHTML=`<span></span><svg viewBox="0 0 100 16" aria-label="Shared coefficient scale"><text x="4" y="12">−${extent.toFixed(1)}</text><text x="50" y="12" text-anchor="middle">0</text><text x="96" y="12" text-anchor="end">+${extent.toFixed(1)}</text></svg><span>pp</span>`;
    get('lab-specs').innerHTML=results.map((r,i)=>`${i===0||i===4?`<h3 class="spec-group">${i===0?'Each county counts equally':'Larger populations count more'}</h3>`:''}<button data-spec="${r.id}" class="spec-row"><span>${r.label}</span><svg viewBox="0 0 100 16" aria-hidden="true"><line x1="50" x2="50" y1="0" y2="16" stroke="#6b8684" stroke-dasharray="2 2"/>${r.slope!=null?`<line x1="50" x2="${position(r.slope)}" y1="8" y2="8" stroke="#698e8d"/><circle cx="${position(r.slope)}" cy="8" r="3.5" fill="${i<4?'#94d3ca':'#edb579'}"/>`:''}</svg><b>${signed(r.slope)}</b></button>`).join('');
    get('lab-specs').querySelectorAll('button').forEach(b=>b.onclick=()=>{previous=current();chosen=b.dataset.spec;renderChoice();updateURL();});
    const negative=values.filter(v=>v < -.05).length,positive=values.filter(v=>v > .05).length,nearZero=values.some(v=>Math.abs(v)<=.05);
    get('lab-reading-title').textContent=negative&&positive?'The sign depends on the specification.':nearZero?'The association approaches zero in some specifications.':'The sign persists across the selected specifications.';
    get('lab-reading').textContent=`Across the ${values.length} estimable choices, the association ranges from ${signed(Math.min(...values))} to ${signed(Math.max(...values))} percentage points per ${study.exposure}. ${negative&&positive?'Both signs exceed the descriptive ±0.05 pp threshold, so direction is sensitive to these choices.':nearZero?'At least one fit is within ±0.05 pp of zero per exposure increment. This descriptive threshold is not a significance test.':'Agreement across these choices describes stability within this small set.'} The spread is not a confidence interval, and persistence does not identify a causal effect.`;
    get('lab-measurement').textContent=study.measurement;get('lab-mechanism').textContent=study.mechanism;get('lab-design').textContent=study.design;get('lab-next-question').textContent=study.question;get('lab-data-needed').textContent='Data needed: '+study.need;
    get('lab-methods').innerHTML=`<p><b>Estimand:</b> a linear county-level association per ${esc(study.exposure)}. Within-state fits remove weighted state means. Adjusted fits also partial out median age and log population density using weighted orthogonal projection.</p><p><b>Common sample:</b> require both measures, age, positive density, positive population, and state. Population weights use ACS total population to change the descriptive emphasis; they are neither precision weights nor adult or renter denominators. No individual-level effect is estimated.</p><p><b>Partial regression:</b> both axes show residuals after projecting the exposure and outcome on the selected adjustment variables. Pooled unadjusted fits subtract the overall means; within-state fits subtract state means. The slope uses the selected weights and recovers the full-model coefficient by the Frisch–Waugh–Lovell result. Axes remain fixed across the eight fits for this outcome.</p><p><b>Fit and influence:</b> RMSE is the square root of the weighted mean squared residual, evaluated in sample. The hat value is a diagonal of the weighted projection matrix. County influence is the exact change in the exposure coefficient under case deletion, holding the specification fixed, when deletion preserves rank. A large residual does not necessarily imply a large coefficient change.</p><p><b>Geographic sensitivity:</b> each state-deletion refit drops one state from the common sample and re-estimates the same specification. This is a sensitivity diagnostic, not cross-validation, a jackknife standard error, or a confidence interval. County and state deletion calculations were checked against independent R fits.</p><p><b>Map colors:</b> symmetric thresholds use the 40th and 80th percentiles of absolute residuals pooled across all eight fits. They remain fixed as the selected specification changes. A residual describes disagreement with the selected linear fit, not policy performance.</p><p><b>Adjustment is a hypothesis:</b> age, density, and state are illustrative context variables, not a validated confounder set. Conditioning on a mediator or collider can distort a causal interpretation. More adjustment is not automatically better.</p><p><b>Uncertainty:</b> coefficient intervals are omitted because spatial dependence, survey error, and generated health outcomes need an explicit uncertainty model. CDC intervals shown for places describe each health estimate; they do not propagate through these fits.</p><ol><li><a href="https://www.nature.com/articles/s41562-020-0912-z" target="_blank" rel="noopener">Simonsohn, Simmons & Nelson (2020), Specification curve analysis</a>. Motivation for exposing analytical choices; its inferential procedure is not implemented here.</li><li><a href="https://stat.ethz.ch/R-manual/R-devel/library/stats/html/lm.influence.html" target="_blank" rel="noopener">R linear-model influence diagnostics</a>. Hat values and coefficient changes under case deletion.</li><li><a href="https://www.cdc.gov/places/methodology/index.html" target="_blank" rel="noopener">CDC PLACES methodology</a>. Model inputs, small-area estimation, and uncertainty.</li><li><a href="https://www.cdc.gov/places/current-release-notes/index.html" target="_blank" rel="noopener">CDC release notes</a> and <a href="https://www.cdc.gov/places/faqs/index.html" target="_blank" rel="noopener">FAQ</a>. Source periods, absent states, and the minimum adult population.</li><li><a href="https://data.cdc.gov/resource/swc5-untb.json" target="_blank" rel="noopener">CDC 2025 county dataset</a>. Diabetes supplement imported ${esc(supplement.accessed.slice(0,10))}; all ${supplement.matched_existing.toLocaleString()} existing nonmissing crude estimates matched exactly.</li><li><a href="https://www.census.gov/programs-surveys/acs/guidance/estimates.html" target="_blank" rel="noopener">Census guidance on ACS estimates</a>. Five-year measurement and interpretation.</li></ol>`;
    renderChoice();updateURL();
  }
  try{
    worker=new Worker(new URL('./research.worker.js',import.meta.url),{type:'module'});
    worker.postMessage({type:'init',rows});
    worker.onmessage=({data})=>{
      if(data.id!==workerRequest||!el.isConnected)return;
      if(data.error){get('lab-sensitivity').textContent='The state-deletion diagnostic could not be computed.';get('lab-sensitivity').setAttribute('aria-busy','false');return;}
      sensitivityCache.set(activeSensitivityKey,data.result);renderSensitivity(data.result);
    };
    worker.onerror=()=>{if(!el.isConnected)return;get('lab-sensitivity').textContent='State-deletion diagnostics could not load. The main estimates remain available.';get('lab-sensitivity').setAttribute('aria-busy','false');};
  }catch{worker=null;}
  countyOptions();render();
  el.querySelectorAll('[data-study]').forEach(b=>b.onclick=()=>{study=STUDIES.find(s=>s.id===b.dataset.study);prediction='';revealed=true;previous=null;render();});
  el.querySelectorAll('[data-predict]').forEach(b=>b.onclick=()=>{prediction=b.dataset.predict;chosen='state-context-county';revealed=true;render();animateEntrance(get('lab-results'));});
  get('lab-skip').onclick=()=>{revealed=true;render();animateEntrance(get('lab-results'));};
  get('lab-pause').onclick=()=>{revealed=false;prediction='';render();get('lab-prediction').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});};
  el.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>get(b.dataset.jump).scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'}));
  get('lab-model-select').onchange=e=>{previous=current();chosen=e.target.value;renderChoice();updateURL();};
  get('lab-model-expand').onclick=()=>{const open=el.querySelector('.specification-rail').classList.toggle('show-all-models');get('lab-model-expand').setAttribute('aria-expanded',String(open));get('lab-model-expand').textContent=open?'Collapse comparison −':'Show all eight estimates +';};
  get('lab-outcome').onchange=e=>{measure=e.target.value;prediction='';previous=null;render();};
  get('lab-search').oninput=countyOptions;
  get('lab-county').onchange=e=>selectPlace(e.target.value);
  const noteKey='atlas-research-note';
  try{get('lab-notes').value=localStorage.getItem(noteKey)||'';}catch{get('lab-status').textContent='Device storage unavailable. Export your record before leaving.';}
  get('lab-notes').oninput=()=>{try{localStorage.setItem(noteKey,get('lab-notes').value);}catch{get('lab-status').textContent='Could not save notes on this device.';}};
  get('lab-share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);get('lab-status').textContent='View copied. Your notes are not included.';}catch{get('lab-status').textContent='Copy the address from your browser.';}};
  const estimates=()=>results.map(({points,...r})=>({study:study.id,exposure:study.x,outcome:study.id==='health'&&measure==='adjusted'?'diabetes_adjusted':study.y,exposure_increment:study.step,...r}));
  get('lab-export').onclick=()=>saveFile(csv(estimates(),['study','exposure','outcome','exposure_increment','id','label','weight','within','adjust','n','rank','slope','beta','rmse']),'atlas-specifications.csv','text/csv');
  get('lab-sample-export').onclick=()=>saveFile(csv(sample,['GEOID','county_name','state_name',study.x,study.y,...(study.id==='health'?['diabetes_adjusted']:[]),'median_age','pop_density_km2','pop_total']),'atlas-common-sample.csv','text/csv');
  get('lab-record').onclick=()=>saveFile(JSON.stringify({version:2,created:new Date().toISOString(),url:location.href,study:study.id,outcome,exposure_increment:study.exposure,selected_specification:chosen,selected_county:selected,prediction,notes:get('lab-notes').value,common_sample_geoids:sample.map(r=>r.GEOID),estimates:estimates(),geographic_sensitivity:diagnosticResults,diagnostic_status:diagnosticResults?'complete':'pending or unavailable',sources:{acs:'2018–2022 5-year',places:supplement.source,places_survey_year:supplement.survey_year,places_accessed:supplement.accessed},interpretation:'Descriptive county associations. The specification and state-deletion ranges are not confidence intervals. No causal effects estimated.'},null,2),'atlas-research-record.json','application/json');
  el.querySelectorAll('.lab-header-v3,.analysis-toolbar,.lab-workspace').forEach((node,i)=>animateEntrance(node,i*60));
  return ()=>worker?.terminate();
}
