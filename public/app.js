"use strict";
const $=id=>document.getElementById(id);
let paused=false, busy=false, timer=null;
$("pause").addEventListener("click",()=>{paused=!paused;$("pause").textContent=paused?"Resume":"Pause";if(!paused)refresh();});
const labels={online:"Online",offline:"Offline",unknown:"Unknown"};
const NAMES=["Cek Status IMEI","Cek History IMEI","Cek Bea Cukai","Cek Until","Create Barcode"];
function element(tag,className,value){const el=document.createElement(tag);if(className)el.className=className;if(value!==undefined)el.textContent=value;return el;}
function time(iso){const d=new Date(iso);return Number.isNaN(d.getTime())?"—":d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit",second:"2-digit",timeZone:"Asia/Jakarta"});}
function render(data){
 $("demo").hidden=!data.demo;
 const services=Array.isArray(data.services)?data.services:[];
 const offline=services.filter(s=>s.state==="offline").length;
 const unknown=services.filter(s=>s.state==="unknown").length;
 const allOnline=services.length===5&&services.every(s=>s.state==="online");
 $("hero").className="hero"+(offline?" offline":!allOnline?" unknown":"");
 $("heroIcon").textContent=offline?"⚠":allOnline?"✓":"◌";
 $("headline").textContent=offline?"Partial Service Outage":allOnline?"All Systems Operational":"Service Status Unavailable";
 $("summary").textContent=offline?offline+" layanan mengalami gangguan.":allOnline?"Seluruh layanan CeirGo berjalan normal.":"Sebagian status belum dapat dipastikan dari aktivitas terbaru.";
 $("updated").textContent="Updated "+time(data.updatedAt)+" WIB";
 const container=$("services");container.replaceChildren();
 for(const s of services){const row=element("div","service");const left=element("div");left.append(element("strong","",s.name),element("small","","Last activity: "+(s.lastActivity?time(s.lastActivity)+" WIB":"Belum tersedia")));const pill=element("span","pill "+(s.state==="online"?"online":s.state==="offline"?"offline-pill":"unknown-pill"),labels[s.state]||"Unknown");row.append(left,pill);container.append(row);}
 $("incident").textContent=offline?"Gangguan terdeteksi pada "+offline+" layanan. Monitoring pemulihan sedang berlangsung.":unknown?"Belum ada data terbaru yang cukup untuk memastikan seluruh layanan.":"Tidak ada gangguan aktif yang terdeteksi dari hasil monitoring.";
 const feed=$("activity");feed.replaceChildren();
 const activities=Array.isArray(data.activities)?data.activities:[];
 if(!activities.length){feed.append(element("p","muted","Belum ada aktivitas order terbaru."));return;}
 for(const a of activities){const line=element("div","entry");line.append(element("time","","["+time(a.time)+"]"));const label=a.state==="completed"?"✓ Completed":a.state==="error"?"✕ Error":"◌ Processing";line.append(element("span",a.state==="completed"?"success":a.state==="error"?"failure":"processing",label+" — "+a.name));feed.append(line);}
}
async function refresh(){
 if(paused||document.hidden||busy)return;
 busy=true;
 try{const r=await fetch("/api/status",{cache:"no-store"});if(!r.ok)throw Error("unavailable");render(await r.json());}
 catch{render({updatedAt:new Date().toISOString(),services:NAMES.map(name=>({name,state:"unknown"})),activities:[]});}
 finally{busy=false;}
}
function schedule(){clearInterval(timer);timer=null;if(!document.hidden){refresh();timer=setInterval(refresh,10000);}}
document.addEventListener("visibilitychange",schedule);
window.addEventListener("pagehide",()=>{clearInterval(timer);timer=null;});
schedule();
