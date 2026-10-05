import {scaleLinear} from 'd3';
export const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const signed=v=>v==null?'Unavailable':`${v<0?'−':v>0?'+':''}${Math.abs(v)>0&&Math.abs(v)<.01?Math.abs(v).toPrecision(2):Math.abs(v).toFixed(2)}`;

export function animateEntrance(element,delay=0) {
  if(!element||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  element.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],
    {duration:480,delay,easing:'cubic-bezier(.22,.68,0,1)',fill:'backwards'});
}

export function scatterDomains(results,step){
  const points=results.flatMap(r=>r.points);
  const xmax=Math.max(.1,...points.map(r=>Math.abs(r.partialX/step)));
  const ymax=Math.max(.1,...points.map(r=>Math.abs(r.partialY)));
  return {x:[-xmax*1.04,xmax*1.04],y:[-ymax*1.04,ymax*1.04]};
}

export function drawPartialPlot(el,fit,domains,step,selected,onSelect) {
  const x=scaleLinear(domains.x,[58,714]).nice(),y=scaleLinear(domains.y,[382,24]).nice();
  if(!el._partialNodes){
    el.innerHTML='<svg viewBox="0 0 740 435" role="img" aria-label="Partial regression: outcome and exposure after removing the selected adjustment variables"><defs><clipPath id="partial-clip"><rect x="58" y="24" width="656" height="358"/></clipPath></defs><g class="plot-grid"></g><g class="plot-cloud"></g><path class="plot-fit" fill="none" stroke="#183a43" stroke-width="2" clip-path="url(#partial-clip)"/><g class="plot-selected"></g><g class="plot-axes"></g></svg>';
    el._partialNodes=new Map();
  }
  const svg=el.querySelector('svg'),grid=svg.querySelector('.plot-grid'),axes=svg.querySelector('.plot-axes');
  grid.innerHTML=x.ticks(5).map(t=>`<line x1="${x(t)}" x2="${x(t)}" y1="24" y2="382" class="${t===0?'plot-zero':''}"/>`).join('')+
    y.ticks(5).map(t=>`<line x1="58" x2="714" y1="${y(t)}" y2="${y(t)}" class="${t===0?'plot-zero':''}"/>`).join('');
  axes.innerHTML=x.ticks(5).map(t=>`<text x="${x(t)}" y="404" text-anchor="middle">${t}</text>`).join('')+
    y.ticks(5).map(t=>`<text x="46" y="${y(t)+4}" text-anchor="end">${t}</text>`).join('')+
    '<text x="386" y="430" text-anchor="middle">Residual exposure / stated increment</text><text x="58" y="13">Residual outcome · percentage points</text>';
  const existing=new Set();
  for(const p of fit.points){
    existing.add(p.GEOID);
    let node=el._partialNodes.get(p.GEOID);
    if(!node){node=document.createElementNS('http://www.w3.org/2000/svg','circle');node.dataset.geoid=p.GEOID;node.setAttribute('r','2.2');node.append(document.createElementNS('http://www.w3.org/2000/svg','title'));svg.querySelector('.plot-cloud').append(node);el._partialNodes.set(p.GEOID,node);}
    node.style.transform=`translate(${x(p.partialX/step)}px,${y(p.partialY)}px)`;
    node.querySelector('title').textContent=`${p.county_name}, ${p.state_name}: residual X ${(p.partialX/step).toFixed(2)}, residual Y ${p.partialY.toFixed(2)} pp`;
  }
  for(const[id,node]of el._partialNodes)if(!existing.has(id)){node.remove();el._partialNodes.delete(id);}
  const lo=x.domain()[0],hi=x.domain()[1];
  svg.querySelector('.plot-fit').setAttribute('d',fit.slope==null?'':`M${x(lo)},${y(lo*fit.slope)}L${x(hi)},${y(hi*fit.slope)}`);
  // Clip an unconstrained linear fit to the plotting region without clipping labels.
  const p=fit.points.find(r=>r.GEOID===selected);
  svg.querySelector('.plot-selected').innerHTML=p?`<circle cx="${x(p.partialX/step)}" cy="${y(p.partialY)}" r="6" fill="#b0673f" stroke="#fff" stroke-width="2"/>`:'';
  svg.onclick=e=>{if(e.target.dataset.geoid)onSelect(e.target.dataset.geoid);};
}

export function drawIntervals(el,entry,name){
  if(!entry?.crude||!entry?.adjusted)return false;
  const ceiling=Math.ceil(Math.max(entry.crude.high,entry.adjusted.high)/5)*5;
  const x=scaleLinear([0,ceiling],[44,524]);
  el.innerHTML=`<svg viewBox="0 0 560 190" role="img" aria-label="${escapeHTML(name)}: crude and age-adjusted diabetes estimates with CDC 95% intervals">
    ${x.ticks(4).map(t=>`<line x1="${x(t)}" x2="${x(t)}" y1="28" y2="144" stroke="#d7ddd4"/><text x="${x(t)}" y="172" text-anchor="middle">${t}%</text>`).join('')}
    ${[['crude','Crude'],['adjusted','Age-adjusted']].map(([key,label],i)=>{const r=entry[key],cy=60+i*65;return `<text x="44" y="${cy-20}">${label} · ${r.estimate.toFixed(1)}% [${r.low.toFixed(1)}, ${r.high.toFixed(1)}]</text><line x1="${x(r.low)}" x2="${x(r.high)}" y1="${cy}" y2="${cy}" stroke="${i?'#b0673f':'#27687a'}" stroke-width="3"/><circle cx="${x(r.estimate)}" cy="${cy}" r="5" fill="${i?'#b0673f':'#27687a'}"/>`;}).join('')}</svg>`;
  return true;
}

export function sensitivityChart(el,result){
  const valid=result.omitted.filter(r=>r.slope!=null);
  if(!valid.length){el.textContent='No state-deletion fits are estimable.';return;}
  const values=valid.map(r=>r.slope),lo=Math.min(...values,result.baseline),hi=Math.max(...values,result.baseline);
  const pad=Math.max(.03,(hi-lo)*.18),x=scaleLinear([lo-pad,hi+pad],[45,725]).nice();
  el.innerHTML=`<svg viewBox="0 0 760 120" role="img" aria-label="Association after omitting each state in turn. Each dot is one refit.">
    <line x1="${x(result.baseline)}" x2="${x(result.baseline)}" y1="10" y2="75" stroke="#173b45" stroke-dasharray="3 3"/>
    ${[...valid].sort((a,b)=>a.slope-b.slope).map((r,i)=>`<circle cx="${x(r.slope)}" cy="${28+(i%4)*10}" r="4" fill="#598f96" fill-opacity=".8"><title>Omit ${escapeHTML(r.state)}: ${signed(r.slope)} pp; ${r.removed} counties removed</title></circle>`).join('')}
    ${x.ticks(5).map(t=>`<text x="${x(t)}" y="100" text-anchor="middle">${t.toFixed(2)}</text>`).join('')}
    <text x="380" y="118" text-anchor="middle">Association · percentage points per stated exposure increment</text></svg>`;
}
