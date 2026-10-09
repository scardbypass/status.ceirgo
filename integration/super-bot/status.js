"use strict";
// Copy into SUPER-BOT plugins/status.js; adapt command loader if necessary.
// No credentials required. Requires Node.js 18+.
const ENDPOINT = process.env.CEIRGO_PUBLIC_STATUS_URL || "https://status.ceirgo.id/api/status";
const NAMES = ["Cek Status IMEI","Cek History IMEI","Cek Bea Cukai","Cek Until","Create Barcode"];
const ICON = {online:"🟢",offline:"🔴",unknown:"⚪"};
async function buildStatusMessage(){
  const response=await fetch(ENDPOINT,{headers:{accept:"application/json"},signal:AbortSignal.timeout(6000)});
  if(!response.ok)throw Error("Status API unavailable");
  const data=await response.json();
  if(!Array.isArray(data.services))throw Error("Invalid status response");
  const services=NAMES.map(name=>{
    const row=data.services.find(s=>s && s.name===name);
    const state=["online","offline","unknown"].includes(row?.state)?row.state:"unknown";
    return {name,state};
  });
  const online=services.filter(s=>s.state==="online").length;
  const offline=services.filter(s=>s.state==="offline").length;
  const title=offline?"⚠️ *PARTIAL SERVICE OUTAGE*":online===5?"✅ *ALL SYSTEMS OPERATIONAL*":"⚪ *STATUS BELUM TERKONFIRMASI*";
  return ["📡 *CEIRGO • SYSTEM STATUS*",title,"",...services.map(s=>ICON[s.state]+" "+s.name+" — "+s.state.toUpperCase()),"",`Operational: ${online}/5 Services`,"","🌐 https://status.ceirgo.id"].join("\n");
}
module.exports={
  commands:["status","ceirgostatus"],
  menuSection:"TOOLS",
  menu:"/status",
  async run({reply}){
    try {return await reply(await buildStatusMessage());}
    catch {return await reply("⚪ *CEIRGO STATUS*\nStatus layanan belum dapat diambil saat ini.\n🌐 https://status.ceirgo.id");}
  }
};
