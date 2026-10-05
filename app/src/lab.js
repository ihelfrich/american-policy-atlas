import {state,loadJSON} from './data.js';
import {number,csv} from './analysis.js';
import {drawCountyMap} from './investigate.js';
import {specificationSet,estimateDirection} from './research.js';

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const signed=v=>v==null?'Not estimable':`${v>0?'+':''}${v.toFixed(2)}`;
const STUDIES=[
  {id:'health',title:'Prosperity & health',x:'median_hh_income',y:'diabetes_pct',step:10000,exposure:'$10,000 higher household income',outcome:'diabetes prevalence',
    hypothesis:'Counties with higher household incomes tend to have lower adult diabetes prevalence.',
    mechanism:'Income could shape food, housing, working conditions, and access to care. Health could also affect earning capacity; migration and local conditions could influence both.',
    design:'An income policy with plausibly exogenous eligibility or rollout, measured before and after, could support a stronger design. Individual or linked longitudinal outcomes, pre-policy trends, and spillover checks would be needed.',
    measurement:'PLACES health estimates are modeled using socioeconomic and demographic predictors. Adjustment here does not remove that model dependence. Median county age is not an adult age distribution.'},
  {id:'housing',title:'Income & housing pressure',x:'median_hh_income',y:'rent_burden_pct',step:10000,exposure:'$10,000 higher household income',outcome:'median rent share',
    hypothesis:'Counties with higher household incomes tend to devote a smaller share of renter income to rent.',
    mechanism:'Higher earnings may relieve pressure, while expensive housing and sorting of renters into particular places may work in the other direction. Local medians can mask displacement.',
    design:'Study a specific housing-supply or subsidy change with a credible comparison group, timing, pre-trends, and displacement checks. Renter-level income and rent are needed to align the population being compared.',
    measurement:'Median household income covers all households. The rent-share measure covers cash-rent renters with a computable ratio. It is not the proportion of renters paying more than 30%.'},
  {id:'access',title:'Poverty & digital access',x:'pct_poverty',y:'pct_broadband',step:10,exposure:'10 percentage points more poverty',outcome:'household broadband subscriptions',
    hypothesis:'Counties with more poverty tend to have fewer household broadband subscriptions.',
    mechanism:'Affordability, service availability, digital skills, and local labor markets could all contribute. Subscriptions alone cannot distinguish these mechanisms.',
    design:'Separate infrastructure rollout from an affordability intervention. Combine credible rollout or eligibility variation with coverage, prices, and household subscription data, while checking selection and spillovers.',
    measurement:'Poverty is a person-based measure; broadband subscriptions are household-based. The data do not identify whether people in poverty live in the households without subscriptions.'},
];

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
  let revealed=query.get('show')==='1',prediction='',results,sample,outcome;
  el.innerHTML=`<header class="lab-heading"><div><span class="kicker">The Evidence Lab / 01</span><h1>How much of the story<br><em>survives?</em></h1><p>A single line can make a story look settled. Change the analytical choices. Watch what holds, what moves, and where the explanation runs out.</p></div><div class="lab-principle"><span>MAKE A CLAIM</span><i>↓</i><span>CHANGE THE LENS</span><i>↓</i><span>FOLLOW THE EXCEPTION</span></div></header>
    <div class="lab-study-tabs" aria-label="Research question">${STUDIES.map(s=>`<button data-study="${s.id}">${s.title}</button>`).join('')}</div>
    <section class="lab-question"><div><span class="kicker">Your starting claim</span><h2 id="lab-hypothesis"></h2><div id="lab-measure"><label>Health measure <select id="lab-outcome"><option value="crude">Crude prevalence</option><option value="adjusted">Age-adjusted prevalence</option></select></label><p>CDC’s age-adjusted estimate standardizes the age distribution. This changes the outcome; adjusting for median age in a regression is a separate choice.</p></div></div><div class="lab-prediction"><span class="kicker">Pause before the result</span><p id="lab-prediction-question"></p><div>${[['lower','Lower'],['little','Close to zero'],['higher','Higher']].map(([v,l])=>`<button data-predict="${v}">${l}</button>`).join('')}</div><button id="lab-skip" class="lab-text-button">Explore without a prediction →</button><p id="lab-prediction-note" role="status"></p></div></section>
    <div id="lab-results" hidden>
      <div class="lab-sample" id="lab-sample"></div>
      <section class="lab-workbench"><div class="lab-spec-panel"><span class="kicker">01 / Test the choices</span><h2>One dataset.<br>Eight readings.</h2><p>Choose a row to inspect its fit. Every dot uses the same counties and the same exposure increment.</p><div class="spec-axis" id="lab-axis"></div><div id="lab-specs"></div><p class="lab-fine">Dots are point estimates, not confidence intervals. These eight choices are a teaching set, not an exhaustive or preregistered specification curve. Their agreement is not a significance test.</p></div>
      <div class="lab-result-panel"><div class="lab-estimate"><span id="lab-model-name"></span><strong id="lab-value"></strong><p id="lab-estimate-caption"></p></div><div class="lab-map-heading"><div><span class="kicker">02 / Follow the exception</span><h3>Where does the fit fall short?</h3></div><span class="residual-key"><i></i>Below fit <i></i>Above fit</span></div><div id="lab-map" class="county-map"></div><p id="lab-map-note" class="lab-fine"></p><div id="lab-outliers" class="lab-outliers"></div></div></section>
      <section class="lab-place"><div><span class="kicker">03 / A place, not just a point</span><label for="lab-county">Inspect a county</label><input type="search" id="lab-search" placeholder="Search county or state" aria-label="Search county or state"><select id="lab-county"></select><div id="lab-place-detail"></div></div><div id="lab-interval"></div></section>
      <section class="lab-interpretation"><div><span class="kicker">04 / What have we learned?</span><h2 id="lab-reading-title"></h2><p id="lab-reading"></p><p id="lab-measurement"></p></div><div class="lab-design-note"><span class="kicker">From exploration to a research design</span><h3>What evidence comes next?</h3><p id="lab-mechanism"></p><p id="lab-design"></p></div></section>
      <section class="lab-repro"><div><span class="kicker">Keep the analytical trail</span><h2>An explanation you can revisit.</h2><p>Download all eight estimates and the exact common sample, or save a research record with your prediction, notes, sources, and choices.</p><label for="lab-notes">What changed your interpretation?</label><textarea id="lab-notes" rows="4" placeholder="I expected… The comparison changed… I would investigate…"></textarea><p class="lab-fine">Notes stay on this device when storage is available. Shared links contain choices, not your notes.</p><div class="lab-export-actions"><button id="lab-share">Copy view</button><button id="lab-export">Estimates CSV</button><button id="lab-sample-export">Sample CSV</button><button id="lab-record">Research record JSON</button></div><span id="lab-status" role="status"></span></div><details open><summary>Methods & research sources</summary><div id="lab-methods"></div></details></section>
    </div>`;
  const get=id=>el.querySelector('#'+id);
  function countyOptions(){const term=get('lab-search').value.toLowerCase();get('lab-county').innerHTML=rows.filter(r=>r.GEOID===selected||`${r.county_name} ${r.state_name}`.toLowerCase().includes(term)).sort((a,b)=>a.county_name.localeCompare(b.county_name)||a.state_name.localeCompare(b.state_name)).map(r=>`<option value="${r.GEOID}">${esc(r.county_name)}, ${esc(r.state_name)}</option>`).join('');get('lab-county').value=selected;}
  function current(){return results.find(r=>r.id===chosen);}
  function updateURL(){history.replaceState(null,'',`#/lab?${new URLSearchParams({q:study.id,measure,spec:chosen,county:selected,show:revealed?'1':'0'})}`);}
  function selectPlace(id){selected=id;countyOptions();renderChoice();updateURL();}
  function renderChoice(){
    const fit=current();
    get('lab-model-name').textContent=`${fit.label} · ${fit.weight==='county'?'Equal county weights':'Population weights'}`;
    get('lab-value').textContent=signed(fit.slope);
    get('lab-estimate-caption').textContent=`percentage points of ${outcome} associated with ${study.exposure}. ${fit.slope==null?fit.reason:'Descriptive, conditional on this specification.'}`;
    el.querySelectorAll('[data-spec]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.spec===chosen)));
    const breaks=drawCountyMap(get('lab-map'),study.y,selected,selectPlace,'all',{values:new Map(fit.points.map(r=>[r.GEOID,r.residual])),label:'difference from the selected fitted value'});
    get('lab-map-note').textContent=`Observed minus fitted outcome, in percentage points. Blue is below fit; amber is above. Middle band: ±${breaks[2].toFixed(2)}; outer bands start at ±${breaks[3].toFixed(2)}. Breaks recalculate for each fit. Gray: excluded. These are in-sample residuals, not policy performance scores. Alaska and Hawaii are inset.`;
    const extremes=[...fit.points].sort((a,b)=>Math.abs(b.residual)-Math.abs(a.residual)||a.GEOID.localeCompare(b.GEOID)).slice(0,3);
    get('lab-outliers').innerHTML=extremes.map(r=>`<button data-place="${r.GEOID}"><span>${esc(r.county_name)}, ${esc(r.state_name)}</span><strong>${signed(r.residual)} pp</strong></button>`).join('');
    get('lab-outliers').querySelectorAll('button').forEach(b=>b.onclick=()=>selectPlace(b.dataset.place));
    const row=rows.find(r=>r.GEOID===selected),p=fit.points.find(r=>r.GEOID===selected);
    get('lab-place-detail').innerHTML=`<h3>${esc(row.county_name)}</h3><p>${esc(row.state_name)}</p>${p?`<div class="place-numbers"><div><strong>${number(p[study.id==='health'&&measure==='adjusted'?'diabetes_adjusted':study.y]).toFixed(1)}%</strong><span>Observed estimate</span></div><div><strong>${p.fitted.toFixed(1)}%</strong><span>Fitted value</span></div><div><strong>${signed(p.residual)}</strong><span>Difference, pp</span></div></div><p class="lab-fine">A large residual is a question to investigate. Omitted variables, measurement, and functional form can all contribute. Linear fitted values are unconstrained and can fall outside 0–100.</p>`:'<p>This county is outside the common sample. No fitted value is shown.</p>'}<a href="#/investigate?q=${study.id}&county=${selected}">Explore this place in the Atlas →</a>`;
    const evidence=supplement.county[selected];
    if(study.id==='health'&&evidence?.crude&&evidence?.adjusted){
      const max=Math.max(evidence.crude.high,evidence.adjusted.high)*1.15,px=v=>30+v/max*410;
      get('lab-interval').innerHTML=`<span class="kicker">Read the measurement, too</span><h3>How much is age composition?</h3><p>Crude and age-adjusted diabetes estimates with CDC’s model-based 95% intervals.</p><svg viewBox="0 0 480 150" role="img" aria-label="${esc(row.county_name)} diabetes estimates and 95% intervals">${[['crude','Crude'],['adjusted','Age-adjusted']].map(([k,l],i)=>{const d=evidence[k],y=40+i*65;return `<text x="30" y="${y-16}">${l}: ${d.estimate.toFixed(1)}% (${d.low.toFixed(1)}–${d.high.toFixed(1)})</text><line x1="${px(d.low)}" x2="${px(d.high)}" y1="${y}" y2="${y}" stroke="${i?'#ad602e':'#27687a'}" stroke-width="4"/><circle cx="${px(d.estimate)}" cy="${y}" r="6" fill="${i?'#ad602e':'#27687a'}"/>`;}).join('')}<text x="30" y="140">0%</text><text x="410" y="140">${max.toFixed(0)}%</text></svg><p class="lab-fine">Age-adjustment is a comparison under a standard age distribution. The difference between these estimates is not a causal effect of aging. Overlapping intervals are not a formal test of their difference; their covariance is unavailable.</p>`;
    }else get('lab-interval').innerHTML=`<span class="kicker">What the measurement leaves open</span><h3>${study.id==='health'?'An unavailable estimate is still information.':'A point estimate is not exact.'}</h3><p>${study.id==='health'?(row.state_name==='Kentucky'||row.state_name==='Pennsylvania'?'CDC did not publish the relevant 2023 BRFSS-based estimates for this state.':selected==='48301'?'CDC reports an adult population of 30 for Loving County, below its 50-adult reporting threshold.':'No paired crude and age-adjusted estimate is available in the imported supplement.'):'These ACS values are five-year estimates. Their margins of error have not been imported here. Apparent differences should not be treated as precisely measured.'}</p><p class="lab-fine">${esc(study.measurement)}</p>`;
  }
  function render(){
    const y=study.id==='health'&&measure==='adjusted'?'diabetes_adjusted':study.y;
    outcome=(study.id==='health'&&measure==='adjusted'?'age-adjusted ':'')+study.outcome;
    const set=specificationSet(rows,study.x,y,study.step);results=set.results;sample=set.sample;
    if(!results.some(r=>r.id===chosen))chosen=results[0].id;
    get('lab-hypothesis').textContent=study.hypothesis;
    get('lab-prediction-question').textContent=`With ${study.exposure}, do you expect ${outcome} to be lower or higher after accounting for state, age, and density?`;
    get('lab-measure').hidden=study.id!=='health';get('lab-outcome').value=measure;
    el.querySelectorAll('[data-study]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.study===study.id)));
    get('lab-results').hidden=!revealed;
    const direction=estimateDirection(results.find(r=>r.id==='state-context-county').slope);
    get('lab-prediction-note').textContent=prediction?`Your prediction: ${prediction==='little'?'close to zero':prediction}. The within-state, age + density, equal-county fit is ${direction==='little'?'close to zero':direction}. “Close” means within ±0.05 pp per stated exposure increment; this is a descriptive threshold, not a test.`:'';
    el.querySelectorAll('[data-predict]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.predict===prediction)));
    get('lab-sample').innerHTML=`<strong>${sample.length.toLocaleString()}</strong><span>counties held constant across all eight fits</span><b>${set.excluded}</b><span>excluded for missing measures or nonpositive density/population</span><span class="sample-stamp">ACS 2018–22 ${study.id==='health'?'× BRFSS 2023':''}</span>`;
    const values=results.map(r=>r.slope).filter(v=>v!=null),extent=Math.max(.1,...values.map(Math.abs))*1.15,position=v=>50+v/extent*46;
    get('lab-axis').innerHTML=`<span></span><svg viewBox="0 0 100 16" aria-label="Shared coefficient scale"><text x="4" y="12">−${extent.toFixed(1)}</text><text x="50" y="12" text-anchor="middle">0</text><text x="96" y="12" text-anchor="end">+${extent.toFixed(1)}</text></svg><span>pp</span>`;
    get('lab-specs').innerHTML=results.map((r,i)=>`${i===0||i===4?`<h3 class="spec-group">${i===0?'Each county counts equally':'Larger populations count more'}</h3>`:''}<button data-spec="${r.id}" class="spec-row"><span>${r.label}</span><svg viewBox="0 0 100 16" aria-hidden="true"><line x1="50" x2="50" y1="0" y2="16" stroke="#6b8684" stroke-dasharray="2 2"/>${r.slope!=null?`<line x1="50" x2="${position(r.slope)}" y1="8" y2="8" stroke="#698e8d"/><circle cx="${position(r.slope)}" cy="8" r="3.5" fill="${i<4?'#94d3ca':'#edb579'}"/>`:''}</svg><b>${signed(r.slope)}</b></button>`).join('');
    get('lab-specs').querySelectorAll('button').forEach(b=>b.onclick=()=>{chosen=b.dataset.spec;renderChoice();updateURL();});
    const negative=values.filter(v=>v < -.05).length,positive=values.filter(v=>v > .05).length,nearZero=values.some(v=>Math.abs(v)<=.05);
    get('lab-reading-title').textContent=negative&&positive?'The direction depends on the choices.':nearZero?'Some readings approach zero.':'The direction persists. Its size can still move.';
    get('lab-reading').textContent=`Across the ${values.length} estimable choices, the association ranges from ${Math.min(...values).toFixed(2)} to ${Math.max(...values).toFixed(2)} percentage points per ${study.exposure}. ${negative&&positive?'Both signs exceed the descriptive ±0.05 pp threshold, so direction is sensitive to these choices.':nearZero?'At least one fit is within ±0.05 pp of zero per exposure increment. This descriptive threshold is not a significance test.':'Agreement across these choices describes stability within this small set.'} The spread is not a confidence interval, and persistence does not identify a causal effect.`;
    get('lab-measurement').textContent=study.measurement;get('lab-mechanism').textContent=study.mechanism;get('lab-design').textContent=study.design;
    get('lab-methods').innerHTML=`<p><b>Estimand:</b> a linear county-level association per ${esc(study.exposure)}. Within-state fits remove weighted state means. Adjusted fits also partial out median age and log population density using weighted orthogonal projection.</p><p><b>Common sample:</b> require both measures, age, positive density, positive population, and state. Population weights use ACS total population to change the descriptive emphasis; they are neither precision weights nor adult or renter denominators. No individual-level effect is estimated.</p><p><b>Adjustment is a hypothesis:</b> age, density, and state are illustrative context variables, not a validated confounder set. Conditioning on a mediator or collider can distort a causal interpretation. More adjustment is not automatically better.</p><p><b>Uncertainty:</b> coefficient intervals are omitted because spatial dependence, survey error, and generated health outcomes need an explicit uncertainty model. CDC intervals shown for places describe each health estimate; they do not propagate through these fits.</p><ol><li><a href="https://www.nature.com/articles/s41562-020-0912-z" target="_blank" rel="noopener">Simonsohn, Simmons & Nelson (2020), Specification curve analysis</a>. Motivation for exposing analytical choices; its inferential procedure is not implemented here.</li><li><a href="https://www.cdc.gov/places/methodology/index.html" target="_blank" rel="noopener">CDC PLACES methodology</a>. Model inputs, small-area estimation, and uncertainty.</li><li><a href="https://www.cdc.gov/places/current-release-notes/index.html" target="_blank" rel="noopener">CDC release notes</a> and <a href="https://www.cdc.gov/places/faqs/index.html" target="_blank" rel="noopener">FAQ</a>. Source periods, absent states, and the minimum adult population.</li><li><a href="https://data.cdc.gov/resource/swc5-untb.json" target="_blank" rel="noopener">CDC 2025 county dataset</a>. Diabetes supplement imported ${esc(supplement.accessed.slice(0,10))}; all ${supplement.matched_existing.toLocaleString()} existing nonmissing crude estimates matched exactly.</li><li><a href="https://www.census.gov/programs-surveys/acs/guidance/estimates.html" target="_blank" rel="noopener">Census guidance on ACS estimates</a>. Five-year measurement and interpretation.</li></ol>`;
    renderChoice();updateURL();
  }
  countyOptions();render();
  el.querySelectorAll('[data-study]').forEach(b=>b.onclick=()=>{study=STUDIES.find(s=>s.id===b.dataset.study);prediction='';revealed=false;render();});
  el.querySelectorAll('[data-predict]').forEach(b=>b.onclick=()=>{prediction=b.dataset.predict;chosen='state-context-county';revealed=true;render();});
  get('lab-skip').onclick=()=>{revealed=true;render();};
  get('lab-outcome').onchange=e=>{measure=e.target.value;prediction='';render();};
  get('lab-search').oninput=countyOptions;
  get('lab-county').onchange=e=>selectPlace(e.target.value);
  const noteKey='atlas-research-note';
  try{get('lab-notes').value=localStorage.getItem(noteKey)||'';}catch{get('lab-status').textContent='Device storage unavailable. Export your record before leaving.';}
  get('lab-notes').oninput=()=>{try{localStorage.setItem(noteKey,get('lab-notes').value);}catch{get('lab-status').textContent='Could not save notes on this device.';}};
  get('lab-share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);get('lab-status').textContent='View copied. Your notes are not included.';}catch{get('lab-status').textContent='Copy the address from your browser.';}};
  const estimates=()=>results.map(({points,...r})=>({study:study.id,exposure:study.x,outcome:study.id==='health'&&measure==='adjusted'?'diabetes_adjusted':study.y,exposure_increment:study.step,...r}));
  get('lab-export').onclick=()=>saveFile(csv(estimates(),['study','exposure','outcome','exposure_increment','id','label','weight','within','adjust','n','rank','slope','beta']),'atlas-specifications.csv','text/csv');
  get('lab-sample-export').onclick=()=>saveFile(csv(sample,['GEOID','county_name','state_name',study.x,study.y,...(study.id==='health'?['diabetes_adjusted']:[]),'median_age','pop_density_km2','pop_total']),'atlas-common-sample.csv','text/csv');
  get('lab-record').onclick=()=>saveFile(JSON.stringify({version:1,created:new Date().toISOString(),url:location.href,study:study.id,outcome,exposure_increment:study.exposure,selected_specification:chosen,selected_county:selected,prediction,notes:get('lab-notes').value,common_sample_geoids:sample.map(r=>r.GEOID),estimates:estimates(),sources:{acs:'2018–2022 5-year',places:supplement.source,places_survey_year:supplement.survey_year,places_accessed:supplement.accessed},interpretation:'Descriptive county associations. The specification range is not a confidence interval. No causal effects estimated.'},null,2),'atlas-research-record.json','application/json');
}
