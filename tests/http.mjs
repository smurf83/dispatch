import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
const anon=await fetch(base+'/api/workspace');assert.equal(anon.status,401);
const sign=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=sign.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie,'local auth cookie');
const headers={Cookie:cookie,'Content-Type':'application/json',Origin:base};
let r=await fetch(base+'/api/workspace',{headers});assert.equal(r.status,200);let b=await r.json();let rev=b.revision;const me=b.state.me;assert.ok(['admin','manager'].includes(me.role));
async function action(action,payload={}){const r=await fetch(base+'/api/workspace',{method:'POST',headers,body:JSON.stringify({action,payload,revision:rev})});const b=await r.json();assert.equal(r.status,200,JSON.stringify(b));rev=b.revision;return b.state}
const date=new Date(Date.now()+86400000).toISOString().slice(0,10);
await action('availability',{date,start:'10:00',end:'18:00',locations:'Test Dublin'});
let state=await action('shift',{date,start:'12:00',end:'16:00',location:'Test Dublin',driverId:me.id});const shift=state.shifts.at(-1);
await action('decline',{id:shift.id});state=await action('cover',{id:shift.id});const req=state.requests.find(r=>r.shiftId===shift.id);assert.ok(req);
state=await action('review',{id:req.id,approve:true});assert.equal(state.shifts.find(s=>s.id===shift.id).driverId,me.id);
state=await action('delivery',{name:'HTTP test',address:'12 Camden Street, Dublin 2',eircode:'D02 X285',km:4.2,date});const d=state.deliveries[0];assert.equal(d.fee,6.23);
await action('updateDelivery',{id:d.id,status:'delivered',paid:true});
r=await fetch(base+'/api/workspace',{headers});b=await r.json();assert.equal(b.state.deliveries.find(x=>x.id===d.id).paid,true);
r=await fetch(base+'/api/workspace',{method:'POST',headers,body:JSON.stringify({action:'settings',revision:0,payload:{base:1,perKm:1}})});assert.equal(r.status,409);
r=await fetch(base+'/api/workspace',{method:'POST',headers:{...headers,Origin:'https://untrusted.example'},body:'{}'});assert.equal(r.status,403);
console.log('HTTP checks passed: anonymous rejection, sign-in, durable writes, full shift-cover workflow, delivery fees, payment persistence, concurrency conflict and origin protection.');
