"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const envFile = path.join(__dirname, ".env");
if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile,"utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
}
const PORT = Number(process.env.PORT || 3108);
const URL_STATUS = process.env.CEIRGO_STATUS_API || "https://ceirgo.id/api/public/ceirgo-status";
const DEMO = process.env.DEMO_MODE === "true";
const PRODUCTS = ["Cek Status IMEI","Cek History IMEI","Cek Bea Cukai","Cek Until","Create Barcode"];
let cached = null, expires = 0, inflight = null;
const empty = () => ({updatedAt:new Date().toISOString(),services:PRODUCTS.map(name=>({name,state:"unknown",lastActivity:null})),activities:[],demo:false});
function sanitize(input) {
  const services = PRODUCTS.map(name => {
    const row = Array.isArray(input?.services) ? input.services.find(item => item?.name === name) : null;
    return {name,state:["online","offline","unknown"].includes(row?.state)?row.state:"unknown",lastActivity:validDate(row?.lastActivity)};
  });
  const activities = (Array.isArray(input?.activities)?input.activities:[]).filter(x=>PRODUCTS.includes(x?.name)).slice(0,20).map(x=>({
    name:x.name,state:["completed","processing","error"].includes(x.state)?x.state:"processing",time:validDate(x.time)||new Date().toISOString()
  }));
  return {updatedAt:validDate(input?.updatedAt)||new Date().toISOString(),services,activities,demo:false};
}
function validDate(x){return typeof x==="string" && !Number.isNaN(Date.parse(x)) ? new Date(x).toISOString():null;}
function demoData(){
  const now = new Date().toISOString();
  return {updatedAt:now,services:PRODUCTS.map((name,i)=>({name,state:i===3?"offline":"online",lastActivity:now})),
    activities:PRODUCTS.map((name,i)=>({name,state:i===3?"error":i===2?"processing":"completed",time:now})),demo:true};
}
async function getStatus(){
  if(DEMO) return demoData();
  if(cached && Date.now()<expires) return cached;
  if(!inflight) inflight=(async()=>{
    try {
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),4000);
      let response;
      try {response=await fetch(URL_STATUS,{signal:controller.signal,headers:{accept:"application/json"}});}
      finally {clearTimeout(timeout);}
      if(!response.ok) throw new Error("upstream unavailable");
      const data=sanitize(await response.json());
      cached=data; expires=Date.now()+10000; return data;
    } catch {cached=empty();expires=Date.now()+5000;return cached;}
    finally {inflight=null;}
  })();
  return inflight;
}
const html=fs.readFileSync(path.join(__dirname,"public","index.html"));
const css=fs.readFileSync(path.join(__dirname,"public","style.css"));
const js=fs.readFileSync(path.join(__dirname,"public","app.js"));
const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url||"/","http://localhost").pathname;
  const headers={"X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Frame-Options":"DENY","Cache-Control":"no-store","Content-Security-Policy":"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'"};
  if(req.method!=="GET"){res.writeHead(405,headers);res.end();return;}
  if(pathname==="/api/status"){res.writeHead(200,{...headers,"Content-Type":"application/json; charset=utf-8"});res.end(JSON.stringify(await getStatus()));return;}
  if(pathname==="/health"){res.writeHead(200,{...headers,"Content-Type":"application/json"});res.end('{"ok":true}');return;}
  const asset=pathname==="/"||pathname==="/index.html"?[html,"text/html; charset=utf-8"]:pathname==="/style.css"?[css,"text/css; charset=utf-8"]:pathname==="/app.js"?[js,"text/javascript; charset=utf-8"]:null;
  if(!asset){res.writeHead(404,headers);res.end("Not found");return;}
  res.writeHead(200,{...headers,"Content-Type":asset[1]});res.end(asset[0]);
});
server.listen(PORT,"127.0.0.1",()=>console.log("CeirGo Status listening on 127.0.0.1:"+PORT));
