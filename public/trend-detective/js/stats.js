/* Raízes do Futuro: Island Trend Detective, shared statistics.
   Moved unchanged from the original index.html so the page and the Node tests run the same code.
   Mirrors analysis/stats.py and analysis/trend_analysis.py (Mann-Kendall with Hamed-Rao correction,
   Theil-Sen slope with 95% CI, Pettitt change point, Benjamini-Hochberg FDR, NOAA/NWS heat index).
   Code written with AI assistance (Anthropic Claude) and reviewed by the team. */

export const POWER_MONTHLY = "https://power.larc.nasa.gov/api/temporal/monthly/point";
export const POWER_HOURLY = "https://power.larc.nasa.gov/api/temporal/hourly/point";

export const VARS = {
  T2M:{name:"air temperature",label:"Air temperature at 2 m, annual mean",unit:"°C",agg:"mean",dec:2,up:"warming",down:"cooling"},
  T2M_MAX:{name:"daily maximum temperature",label:"Daily maximum temperature, annual mean",unit:"°C",agg:"mean",dec:2,up:"hotter days",down:"cooler days"},
  PRECTOTCORR:{name:"annual rainfall",label:"Precipitation, annual total",unit:"mm",agg:"sum",dec:0,up:"wetter",down:"drier"},
  RH2M:{name:"relative humidity",label:"Relative humidity at 2 m, annual mean",unit:"%",agg:"mean",dec:2,up:"more humid",down:"drier air"},
  WS2M:{name:"wind speed",label:"Wind speed at 2 m, annual mean",unit:"m/s",agg:"mean",dec:3,up:"windier",down:"calmer"},
  ALLSKY_SFC_SW_DWN:{name:"surface solar radiation",label:"Solar radiation at surface, annual mean",unit:"MJ/m²/day",agg:"mean",dec:3,up:"more sunshine",down:"less sunshine"}
};
export const DAYS = [31,28,31,30,31,30,31,31,30,31,30,31];

/* ---------- statistics (unchanged) ---------- */
export function normCdf(z){const t=1/(1+0.2316419*Math.abs(z));const d=0.3989423*Math.exp(-z*z/2);
  const p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return z>0?1-p:p;}
export function rank(a){const idx=a.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]);const r=new Array(a.length);let i=0;
  while(i<idx.length){let j=i;while(j+1<idx.length&&idx[j+1][0]===idx[i][0])j++;const av=(i+j)/2+1;for(let k=i;k<=j;k++)r[idx[k][1]]=av;i=j+1;}return r;}
export function senSlope(x){const n=x.length,s=[];for(let i=0;i<n-1;i++)for(let j=i+1;j<n;j++)s.push((x[j]-x[i])/(j-i));s.sort((a,b)=>a-b);
  const m=s.length,med=m%2?s[(m-1)/2]:(s[m/2-1]+s[m/2])/2;const c=1.959964*Math.sqrt(n*(n-1)*(2*n+5)/18);
  const lo=Math.max(Math.round((m-c)/2)-1,0),hi=Math.min(Math.round((m+c)/2),m-1);return {slope:med,lo:s[lo],hi:s[hi]};}
export function mannKendall(x){const n=x.length;let S=0;for(let k=0;k<n-1;k++)for(let j=k+1;j<n;j++)S+=Math.sign(x[j]-x[k]);
  const counts={};x.forEach(v=>counts[v]=(counts[v]||0)+1);let tie=0;Object.values(counts).forEach(c=>tie+=c*(c-1)*(2*c+5));
  let varS=(n*(n-1)*(2*n+5)-tie)/18;const b=senSlope(x).slope;const res=x.map((v,i)=>v-b*i);let r=rank(res);const mr=r.reduce((a,c)=>a+c,0)/n;r=r.map(v=>v-mr);
  const den=r.reduce((a,c)=>a+c*c,0);let corr=0;for(let lag=1;lag<n-1;lag++){let num=0;for(let i=0;i<n-lag;i++)num+=r[i]*r[i+lag];const rho=num/den;
    if(Math.abs(rho)>1.959964/Math.sqrt(n))corr+=(n-lag)*(n-lag-1)*(n-lag-2)*rho;}
  const f=Math.max(1+2/(n*(n-1)*(n-2))*corr,1);varS*=f;const z=S>0?(S-1)/Math.sqrt(varS):S<0?(S+1)/Math.sqrt(varS):0;
  return {S,z,p:2*(1-normCdf(Math.abs(z)))};}
export function pettitt(x){const n=x.length;let best=0,k=0;for(let t=0;t<n-1;t++){let u=0;for(let i=0;i<=t;i++)for(let j=t+1;j<n;j++)u+=Math.sign(x[j]-x[i]);
  if(Math.abs(u)>Math.abs(best)){best=u;k=t;}}const p=Math.min(2*Math.exp(-6*best*best/(n**3+n**2)),1);
  const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;return {k,p,before:mean(x.slice(0,k+1)),after:mean(x.slice(k+1))};}
export function bhFdr(ps,q=0.05){const o=ps.map((p,i)=>[p,i]).sort((a,b)=>a[0]-b[0]);let kmax=-1;o.forEach(([p],r)=>{if(p<=q*(r+1)/ps.length)kmax=r;});
  const out=new Array(ps.length).fill(false);for(let r=0;r<=kmax;r++)out[o[r][1]]=true;return out;}

export function analyse(years,vals){const sen=senSlope(vals),mk=mannKendall(vals),pt=pettitt(vals);const n=vals.length,w=Math.min(10,Math.floor(n/3));
  const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;return {sen,mk,pt,first:mean(vals.slice(0,w)),last:mean(vals.slice(-w)),w};}

/* ---------- data ---------- */
export function monthlyUrl(lat,lon,v,y0,y1){
  return `${POWER_MONTHLY}?parameters=${v}&community=AG&longitude=${lon}&latitude=${lat}&start=${y0}&end=${y1}&format=JSON`;}
/* Annual mean (or total, for rainfall) from the NASA POWER monthly JSON; a year with any missing month is skipped. */
export function annualFromMonthly(p,v,y0,y1){const years=[],vals=[],skipped=[];
  for(let y=y0;y<=y1;y++){const m=[];for(let i=1;i<=12;i++){const val=p?.[`${y}${String(i).padStart(2,"0")}`];if(val===undefined||val===null||val<=-990){m.length=0;break;}m.push(val);}
    if(m.length===12){years.push(y);vals.push(VARS[v].agg==="sum"?m.reduce((s,c,i)=>s+c*DAYS[i],0):m.reduce((s,c)=>s+c,0)/12);}else skipped.push(y);}
  return {years,vals,skipped};}
/* getJson(url) defaults to a plain fetch; the page passes its rate-limited, cached fetcher. */
export async function fetchAnnual(lat,lon,v,y0,y1,getJson=defaultGetJson){
  const url=monthlyUrl(lat,lon,v,y0,y1);const j=await getJson(url);
  const p=j?.properties?.parameter?.[v];if(!p)throw new Error("NASA POWER returned no "+v+" values for this place.");
  return {...annualFromMonthly(p,v,y0,y1),url};}
async function defaultGetJson(url){const r=await fetch(url);if(!r.ok)throw new Error("NASA POWER answered "+r.status);return r.json();}

/* ---------- heat index (NOAA/NWS Rothfusz, unchanged) ---------- */
export const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export function heatIndexC(tc,rh){const t=tc*9/5+32;const simple=0.5*(t+61+(t-68)*1.2+rh*0.094);if((simple+t)/2<80)return (simple-32)*5/9;
  let hi=-42.379+2.04901523*t+10.14333127*rh-0.22475541*t*rh-6.83783e-3*t*t-5.481717e-2*rh*rh+1.22874e-3*t*t*rh+8.5282e-4*t*rh*rh-1.99e-6*t*t*rh*rh;
  if(rh<13&&t>=80&&t<=112)hi-=((13-rh)/4)*Math.sqrt(Math.max((17-Math.abs(t-95))/17,0));
  if(rh>85&&t>=80&&t<=87)hi+=((rh-85)/10)*((87-t)/5);return (hi-32)*5/9;}
export function hourlyUrl(lat,lon,y){
  return `${POWER_HOURLY}?parameters=T2M,RH2M&community=AG&longitude=${lon}&latitude=${lat}&time-standard=LST&start=${y}0101&end=${y}1231&format=JSON`;}
/* Same aggregation as the original heatPeriod(), split from the download so it can run on cached years. */
export function heatFromHourly(paramsByYear){const share=Array.from({length:12},()=>new Array(24).fill(0)),n=new Array(12).fill(0);let hotDays=0,days=0;
  for(const p of paramsByYear){const byDay={};
    for(const [k,t] of Object.entries(p.T2M)){const rh=p.RH2M[k];if(t<=-990||rh===undefined||rh<=-990)continue;const day=k.slice(0,8),m=+k.slice(4,6)-1,h=+k.slice(8,10);
      const hi=heatIndexC(t,rh);(byDay[day]=byDay[day]||{m,max:-99,hrs:new Array(24).fill(null)});byDay[day].hrs[h]=hi;if(hi>byDay[day].max)byDay[day].max=hi;}
    for(const d of Object.values(byDay)){n[d.m]++;days++;if(d.max>=32)hotDays++;d.hrs.forEach((v,h)=>{if(v!==null&&v>=32)share[d.m][h]++;});}}
  return {share:share.map((row,m)=>row.map(c=>n[m]?c/n[m]:0)),hotDaysPerYear:hotDays/paramsByYear.length,days};}
export function riskyMonths(share){return share.map((row,m)=>row.some(v=>v>=0.2)?m:-1).filter(m=>m>=0);}
export function firstRiskyHour(share){let h=99;share.forEach(row=>row.forEach((v,i)=>{if(v>=0.2&&i<h)h=i;}));return h===99?null:h;}
export function ruleText(share){const by={};share.forEach((row,m)=>{const h=row.findIndex(v=>v>=0.2);if(h>=0)(by[h]=by[h]||[]).push(m);});
  const hs=Object.keys(by).map(Number).sort((a,b)=>a-b);if(!hs.length)return null;
  return hs.map(h=>`by <strong>${h}h</strong> in ${by[h].map(m=>MON[m]).join(", ")}`).join("; ");}
export function monthsText(ms){if(!ms.length)return "no month";return ms.map(m=>MON[m]).join(", ");}

/* ---------- NASA POWER grid (MERRA-2, 0.5° latitude x 0.625° longitude) ---------- */
export const CELL_DLAT=0.5, CELL_DLON=0.625;
export function powerCell(lat,lon){const clat=Math.max(-90,Math.min(90,Math.round(lat/CELL_DLAT)*CELL_DLAT));
  let clon=Math.round((lon+180)/CELL_DLON)*CELL_DLON-180;if(clon>=180)clon-=360;
  return {lat:+clat.toFixed(4),lon:+clon.toFixed(4),south:Math.max(-90,clat-CELL_DLAT/2),north:Math.min(90,clat+CELL_DLAT/2),west:clon-CELL_DLON/2,east:clon+CELL_DLON/2,key:`${clat.toFixed(3)},${clon.toFixed(4)}`};}
