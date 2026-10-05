import * as Plot from '@observablehq/plot';
import { geoAlbersUsa, geoPath, scaleQuantile } from 'd3';
import { state, VARS, groupedOptions } from './data.js';
import { number, summarize, relationship, csv } from './analysis.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors = ['#e5eee9','#b2d1c5','#76a996','#397e70','#145349'];
let projectedFeatures;
export const QUESTIONS = [
  { id:'health', title:'Does prosperity travel with health?', x:'median_hh_income', y:'diabetes_pct',
    intro:'Compare household income with adult diabetes estimates. Look for a pattern, then look for the places that do not fit it.',
    caution:'CDC models use demographic and socioeconomic information to estimate health outcomes. Some relationships with these predictors may reflect the estimation model itself. Crude prevalence also reflects age composition.',
    next:'What would you need to distinguish the roles of age, health care access, working conditions, and income?' },
  { id:'housing', title:'Where is housing hardest to afford?', x:'median_hh_income', y:'rent_burden_pct',
    intro:'Compare county median incomes with the median share of income spent on gross rent. Expensive housing and high rent burden are different questions.',
    caution:'The income measure covers all households; rent burden covers cash-rent renter households with a computable ratio. These are different populations. A county median can conceal households under severe pressure.',
    next:'How could you compare renters at similar incomes, or measure the share paying more than 30 percent of income?' },
  { id:'access', title:'Who has access to a connected world?', x:'pct_poverty', y:'pct_broadband',
    intro:'Explore poverty and household broadband subscriptions. Test whether the national pattern still holds within a state.',
    caution:'Subscription is different from service availability or quality. These county aggregates cannot tell us whether the people below the poverty line are the same households without broadband.',
    next:'What local evidence would separate affordability, infrastructure availability, and household preferences?' },
];
const params = () => new URLSearchParams(location.hash.split('?')[1] || '');
function format(v, key) {
  if (!Number.isFinite(v)) return 'Not available';
  return VARS[key].unit.startsWith('$') ? '$' + Math.round(v).toLocaleString() : v.toLocaleString(undefined,{maximumFractionDigits:1}) + (VARS[key].unit.startsWith('%') ? '%' : '');
}

export function drawCountyMap(el, variable, selected, onSelect, scope = 'all') {
  // The web GeoJSON follows RFC 7946 ring order; d3's spherical polygons use
  // the opposite convention. Reverse copied rings, never the shared map data.
  const features = projectedFeatures ||= state.counties.features.map(f => ({...f, geometry: {...f.geometry,
    coordinates: f.geometry.type === 'Polygon'
      ? f.geometry.coordinates.map(r => [...r].reverse())
      : f.geometry.coordinates.map(p => p.map(r => [...r].reverse())) }}));
  const projection = geoAlbersUsa().fitExtent([[12,12],[928,518]], {type:'FeatureCollection', features});
  const path = geoPath(projection);
  const scale = scaleQuantile(features.map(f=>number(f.properties[variable])).filter(Number.isFinite), colors);
  el.innerHTML = `<svg viewBox="0 0 940 530" role="img" aria-label="County map of ${esc(VARS[variable].label)}. Alaska and Hawaii shown as insets. ${onSelect ? 'Select a county using the search controls below.' : 'Darker colors indicate higher values.'}">${features.map(f => {
    const p=f.properties, value=number(p[variable]);
    return `<path d="${path(f)||''}" data-geoid="${p.GEOID}" fill="${Number.isFinite(value)?scale(value):'#c8c8c3'}" opacity="${scope==='all'||p.state_name===scope?1:0.18}" stroke="${p.GEOID===selected?'#d47b30':'#faf8f3'}" stroke-width="${p.GEOID===selected?2.4:0.15}"><title>${esc(p.county_name)}, ${esc(p.state_name)}: ${format(value,variable)}</title></path>`;
  }).join('')}</svg>`;
  if (onSelect) el.querySelector('svg').onclick=e=>{const id=e.target.dataset.geoid;if(id)onSelect(id);};
  return scale.quantiles();
}

export function mountCover() {
  const map=document.getElementById('cover-map');
  if (!map) return;
  drawCountyMap(map,'median_hh_income');
  const rows=state.counties.features.map(f=>f.properties);
  document.getElementById('cover-count').textContent=rows.length.toLocaleString();
  document.getElementById('cover-measures').textContent=Object.keys(VARS).length;
}

export function mountInvestigation() {
  const el=document.getElementById('investigation');
  const rows=state.counties.features.map(f=>f.properties);
  const query=params();
  let question=QUESTIONS.find(q=>q.id===query.get('q'))||QUESTIONS[0];
  let x=VARS[query.get('x')]?query.get('x'):question.x;
  let y=VARS[query.get('y')]?query.get('y'):question.y;
  const states=[...new Set(rows.map(r=>r.state_name))].sort();
  let scope=states.includes(query.get('state'))?query.get('state'):'all';
  let selected=rows.find(r=>r.GEOID===query.get('county'))?.GEOID||'29510';
  let comparison=rows.find(r=>r.GEOID===query.get('compare'))?.GEOID||'29189';
  el.innerHTML=`<header class="invest-head"><span class="kicker">A question. A map. Your investigation.</span><h1 id="question-title"></h1><p id="question-intro"></p></header>
    <div class="question-tabs" aria-label="Choose an investigation">${QUESTIONS.map(q=>`<button data-question="${q.id}">${q.title}</button>`).join('')}</div>
    <div class="invest-controls"><label>Compare places in<select id="iq-scope"><option value="all">United States</option>${states.map(s=>`<option>${esc(s)}</option>`).join('')}</select></label><label>Horizontal axis<select id="iq-x">${groupedOptions(x)}</select></label><label>Map color & vertical axis<select id="iq-y">${groupedOptions(y)}</select></label><button id="iq-share" class="action-button">Copy this view</button><span id="iq-share-status" role="status"></span></div>
    <div class="evidence-strip" id="iq-stats" aria-live="polite"></div>
    <div class="invest-panels"><section class="chart-panel"><div class="panel-heading"><span class="step-number">01</span><h2>Find the pattern</h2></div><div id="iq-map" class="county-map"></div><div id="iq-legend" class="map-key"></div><p class="chart-note">Five national quantile classes. Gray: missing. Alaska and Hawaii are inset; areas are not to a common scale. Click a county or use the searchable list below.</p></section>
    <section class="chart-panel"><div class="panel-heading"><span class="step-number">02</span><h2>Question the pattern</h2></div><div id="iq-scatter"></div><p class="chart-note">Each point is a county with both measures available. The line summarizes their association with equal weight per county. It does not estimate a policy effect.</p></section></div>
    <section class="place-section"><div class="panel-heading"><span class="step-number">03</span><h2>Get to know two places</h2></div><p>A national pattern can hide a local difference. Compare any two counties, including places outside your selected state.</p><div class="place-controls"><label>Search counties<input id="iq-search" type="search" placeholder="Try St. Louis, Fulton, or a state" /></label><label>First place<select id="iq-place"></select></label><label>Compare with<select id="iq-compare"></select></label></div><div id="iq-comparison"></div><p class="chart-note">The reference is the median of available county values in your selected scope, not a national household income or population prevalence estimate. St. Louis city and St. Louis County are separate county-equivalent units.</p></section>
    <section class="interpret-section"><div><span class="kicker">Before drawing a conclusion</span><h2>What would change your mind?</h2><p id="iq-caution"></p><p id="iq-next"></p><details><summary>Check the evidence behind this view</summary><div id="iq-sources"></div><p>ACS measures are pooled 2018–2022 estimates. PLACES is a 2025 release of modeled estimates, not a 2025 census of health. These are different observation periods and populations. Margins of error and model intervals are not included in this prototype.</p><p>Missing health values occur across Kentucky and Pennsylvania and in one Texas county in this snapshot. The extraction does not record a reason for every omission. Missing is never treated as zero.</p><p><a href="https://www.cdc.gov/places/methodology/index.html">CDC methodology</a> · <a href="https://www.census.gov/programs-surveys/acs/guidance/estimates.html">Understanding ACS estimates</a> · <a href="#/apparatus/methods">Atlas methods and coverage</a></p></details></div><div class="notebook"><label for="iq-note">Your working explanation</label><p>What do you observe? What else could explain it? What would you investigate next?</p><textarea id="iq-note" rows="6" placeholder="I notice… Another explanation could be… I would want to know…"></textarea><p class="chart-note">Kept on this device when browser storage is available. Never sent to a server.</p><button id="iq-export" class="action-button">Download evidence CSV</button><button id="iq-notes" class="action-button secondary">Download my notes</button><span id="iq-storage-status" role="status"></span></div></section>`;
  const get=id=>el.querySelector('#'+id);
  const options=()=>{
    const term=get('iq-search').value.toLowerCase();
    const matches=rows.filter(r=>`${r.county_name} ${r.state_name}`.toLowerCase().includes(term)||[selected,comparison].includes(r.GEOID)).sort((a,b)=>a.county_name.localeCompare(b.county_name)||a.state_name.localeCompare(b.state_name));
    const markup=matches.map(r=>`<option value="${r.GEOID}">${esc(r.county_name)}, ${esc(r.state_name)}</option>`).join('');
    get('iq-place').innerHTML=markup;get('iq-place').value=selected;
    get('iq-compare').innerHTML=markup;get('iq-compare').value=comparison;
  };
  const download=(text,name,type)=>{const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  function render() {
    const subset=scope==='all'?rows:rows.filter(r=>r.state_name===scope);
    const fit=relationship(subset,x,y), summary=summarize(subset,y);
    get('question-title').textContent=question.title;
    get('question-intro').textContent=question.intro;
    el.querySelectorAll('[data-question]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.question===question.id)));
    get('iq-scope').value=scope;get('iq-x').value=x;get('iq-y').value=y;
    get('iq-stats').innerHTML=`<div><strong>${fit.n.toLocaleString()} / ${subset.length.toLocaleString()}</strong><span>counties with both measures</span></div><div><strong>${format(summary.median,y)}</strong><span>median county · ${esc(VARS[y].label)}</span></div><div><strong>${fit.r==null?'Not estimable':fit.r.toFixed(2)}</strong><span>Pearson correlation · equal county weights</span></div><div><strong>${fit.excluded.toLocaleString()}</strong><span>counties excluded from the relationship</span></div>`;
    const breaks=drawCountyMap(get('iq-map'),y,selected,id=>{selected=id;options();render();},scope);
    get('iq-legend').innerHTML=colors.map((c,i)=>`<span><i style="background:${c}"></i>${i===0?'Below '+format(breaks[0],y):i===4?format(breaks[3],y)+' and above':format(breaks[i-1],y)+' to '+format(breaks[i],y)}</span>`).join('');
    const marks=[Plot.dot(fit.points,{x:'x',y:'y',r:2.3,fill:'#397e70',fillOpacity:0.35,title:d=>`${d.county_name}, ${d.state_name}\n${VARS[x].label}: ${format(d.x,x)}\n${VARS[y].label}: ${format(d.y,y)}`})];
    if(fit.slope!=null){const xs=fit.points.map(d=>d.x);marks.push(Plot.line([Math.min(...xs),Math.max(...xs)].map(v=>({x:v,y:fit.intercept+fit.slope*v})),{x:'x',y:'y',stroke:'#153c35',strokeWidth:2}));}
    marks.push(Plot.dot(fit.points.filter(d=>[selected,comparison].includes(d.GEOID)),{x:'x',y:'y',r:5,fill:'#c66b25',stroke:'white',title:d=>`${d.county_name}, ${d.state_name}`}));
    get('iq-scatter').replaceChildren(fit.n?Plot.plot({width:600,height:360,marginLeft:64,marginBottom:55,x:{label:`${VARS[x].label} (${VARS[x].unit})`,grid:true},y:{label:`${VARS[y].label} (${VARS[y].unit})`,grid:true},marks}):Object.assign(document.createElement('p'),{textContent:'No counties have both measures in this scope. Try another state or variable.'}));
    const a=rows.find(r=>r.GEOID===selected),b=rows.find(r=>r.GEOID===comparison);
    get('iq-comparison').innerHTML=`<div class="table-scroll"><table><caption>Selected places and the ${esc(scope==='all'?'United States':scope)} county median</caption><thead><tr><th scope="col">Measure</th><th scope="col">${esc(a.county_name)}<small>${esc(a.state_name)}</small></th><th scope="col">${esc(b.county_name)}<small>${esc(b.state_name)}</small></th><th scope="col">Scope median</th></tr></thead><tbody>${[...new Set([x,y,'median_hh_income','pct_poverty','pct_broadband'])].map(key=>`<tr><th scope="row">${esc(VARS[key].label)}</th><td>${format(number(a[key]),key)}</td><td>${format(number(b[key]),key)}</td><td>${format(summarize(subset,key).median,key)}</td></tr>`).join('')}</tbody></table></div>`;
    const custom=x!==question.x||y!==question.y;
    get('iq-caution').textContent=custom?'You changed the measures. Check their definitions and denominators below. A relationship between county averages does not identify a relationship between individuals or establish a causal effect.':question.caution;
    get('iq-next').textContent=custom?'Does the pattern survive a different geographic scope? What other variables or study design would help explain it?':question.next;
    get('iq-sources').innerHTML=[...new Set([x,y])].map(key=>`<p><b>${esc(VARS[key].label)}:</b> ${esc(VARS[key].desc)} Source: ${esc(VARS[key].source)}. ${summarize(subset,key).n} of ${subset.length} counties available.</p>`).join('');
    const share=new URLSearchParams({q:question.id,x,y,state:scope,county:selected,compare:comparison});
    history.replaceState(null,'',`#/investigate?${share}`);
    get('iq-export').onclick=()=>download(csv(fit.points,['GEOID','county_name','state_name',...new Set([x,y])]),'atlas-evidence.csv','text/csv');
    get('iq-notes').onclick=()=>download(`${question.title}\n${location.href}\nScope: ${scope}\nX: ${VARS[x].label} (${VARS[x].source})\nY: ${VARS[y].label} (${VARS[y].source})\nComplete counties: ${fit.n}/${subset.length}\nEqual county weights. Descriptive, not causal.\n\n${get('iq-note').value}`,'atlas-notes.txt','text/plain');
  }
  options();render();
  get('iq-search').oninput=options;
  get('iq-place').onchange=e=>{selected=e.target.value;render();};
  get('iq-compare').onchange=e=>{comparison=e.target.value;render();};
  get('iq-scope').onchange=e=>{scope=e.target.value;render();};
  get('iq-x').onchange=e=>{x=e.target.value;render();};
  get('iq-y').onchange=e=>{y=e.target.value;render();};
  el.querySelectorAll('[data-question]').forEach(b=>b.onclick=()=>{question=QUESTIONS.find(q=>q.id===b.dataset.question);x=question.x;y=question.y;render();});
  get('iq-share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);get('iq-share-status').textContent='Link copied.';}catch{get('iq-share-status').textContent='Copy the address from your browser to share this view.';}};
  try{get('iq-note').value=localStorage.getItem('atlas-investigation-note')||'';}catch{get('iq-storage-status').textContent='Browser storage unavailable. Download your notes before leaving.';}
  get('iq-note').oninput=()=>{try{localStorage.setItem('atlas-investigation-note',get('iq-note').value);}catch{get('iq-storage-status').textContent='Could not save on this device. Download your notes.';}};
}
