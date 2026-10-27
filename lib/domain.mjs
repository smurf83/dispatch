export const day = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Dublin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function nextDay(offset=0){const d=new Date(day()+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10)}
export const id = () => crypto.randomUUID();
const fail = m => {throw new Error(m)};
const str = (s,max=200) => typeof s==='string' && s.trim().length>0 && s.length<=max ? s.trim() : fail('Please complete all required fields.');
const money = n => Number.isFinite(Number(n)) && Number(n)>=0 && Number(n)<=10000 ? Math.round(Number(n)*100)/100 : fail('Enter an amount between 0 and 10,000.');
const date = d => /^\d{4}-\d{2}-\d{2}$/.test(d||'') && !isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0,10)===d ? d : fail('Enter a valid date.');
const time = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t||'') ? t : fail('Enter a valid time.');
const overlap = (a,b) => a.date===b.date && a.start<b.end && b.start<a.end;
export function fresh(user){return {drivers:[{id:user.userId,name:user.name||user.email,email:user.email,role:'manager'}],shifts:[],availability:[],requests:[],deliveries:[],settings:{base:3.5,perKm:.65},sample:false};}
export function member(state,user){return state.drivers.find(d=>d.id===user.userId) || state.drivers.find(d=>d.email.toLowerCase()===user.email.toLowerCase());}
export function view(state,me){return {...state,me,drivers:state.drivers.map(d=>me.role==='manager'?d:{id:d.id,name:d.name,role:d.role}),availability:state.availability.filter(a=>me.role==='manager'||a.driverId===me.id),requests:state.requests.filter(r=>me.role==='manager'||r.driverId===me.id),deliveries:state.deliveries.filter(d=>me.role==='manager'||d.driverId===me.id)};}
function eligible(s,driverId,shift){
 if(s.shifts.some(x=>x.id!==shift.id&&x.driverId===driverId&&x.status!=='declined'&&overlap(x,shift)))fail('This driver already has an overlapping shift.');
 const avail=s.availability.filter(a=>a.driverId===driverId&&a.date===shift.date);
 if(!avail.some(a=>a.start<=shift.start&&a.end>=shift.end&&a.locations.some(l=>l.toLowerCase()===shift.location.toLowerCase())))fail('Driver availability must cover the full shift and location.');
}
export function mutate(s,me,action,p={}){
 const manager=()=>{if(me.role!=='manager')fail('Manager access required.');};
 const driver=d=>{if(!s.drivers.some(x=>x.id===d))fail('Driver not found.');return d};
 const getShift=()=>s.shifts.find(x=>x.id===p.id)||fail('Shift not found.');
 switch(action){
 case 'availability': {const start=time(p.start),end=time(p.end);if(start>=end)fail('End time must be after start time. Split overnight availability into two days.');const a={id:id(),driverId:me.id,date:date(p.date),start,end,locations:str(p.locations).split(',').map(x=>x.trim()).filter(Boolean)};if(a.date<day())fail('Choose today or a future date.');s.availability.push(a);break;}
 case 'removeAvailability': {const a=s.availability.find(x=>x.id===p.id);if(!a||a.driverId!==me.id)fail('Availability not found.');s.availability=s.availability.filter(x=>x.id!==p.id);break;}
 case 'shift': {manager();const sh={id:id(),date:date(p.date),start:time(p.start),end:time(p.end),location:str(p.location,80),driverId:p.driverId?driver(p.driverId):null,status:p.driverId?'assigned':'open'};if(sh.date<day()||sh.start>=sh.end)fail('Choose a future shift with an end time after its start.');if(sh.driverId)eligible(s,sh.driverId,sh);s.shifts.push(sh);break;}
 case 'assign': {manager();const sh=getShift();if(sh.date<day())fail('This shift has passed.');const d=driver(p.driverId);eligible(s,d,sh);sh.driverId=d;sh.status='assigned';s.requests=s.requests.filter(x=>x.shiftId!==sh.id);break;}
 case 'decline': {const sh=getShift();if(sh.driverId!==me.id)fail('You can only decline your own shift.');if(sh.date<day())fail('This shift has passed.');sh.driverId=null;sh.status='open';s.requests=s.requests.filter(x=>x.shiftId!==sh.id);break;}
 case 'cover': {const sh=getShift();if(sh.driverId||sh.status!=='open'||sh.date<day())fail('This shift is no longer available.');eligible(s,me.id,sh);if(s.requests.some(r=>r.shiftId===sh.id&&r.driverId===me.id))fail('You have already requested this shift.');s.requests.push({id:id(),shiftId:sh.id,driverId:me.id,createdAt:new Date().toISOString()});break;}
 case 'review': {manager();const r=s.requests.find(x=>x.id===p.id)||fail('Request not found.');const sh=s.shifts.find(x=>x.id===r.shiftId)||fail('Shift not found.');if(p.approve){if(sh.driverId||sh.date<day())fail('Shift is no longer available.');eligible(s,r.driverId,sh);sh.driverId=r.driverId;sh.status='assigned';s.requests=s.requests.filter(x=>x.shiftId!==sh.id);}else s.requests=s.requests.filter(x=>x.id!==r.id);break;}
 case 'driver': {manager();const email=str(p.email,160).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Enter a valid email.');if(s.drivers.some(d=>d.email.toLowerCase()===email))fail('This email is already on the team.');s.drivers.push({id:id(),name:str(p.name,80),email,role:'driver'});break;}
 case 'delivery': {const km=money(p.km);const d={id:id(),driverId:me.role==='manager'&&p.driverId?driver(p.driverId):me.id,date:date(p.date||day()),name:str(p.name,80),address:str(p.address,400),eircode:(p.eircode||'').toUpperCase().replace(/\s/g,''),phone:(p.phone||'').trim(),km,fee:money(s.settings.base+km*s.settings.perKm),paid:!!p.paid,status:'pending',notes:typeof p.notes==='string'?p.notes.slice(0,500):'',createdAt:new Date().toISOString()};if(d.eircode&&!/^(?:[AC-FHKNPRTV-Y]\d{2}|D6W)[0-9AC-FHKNPRTV-Y]{4}$/.test(d.eircode))fail('Check the Eircode (for example D02 X285).');if(d.phone&&!/^[+\d\s()\-]{7,25}$/.test(d.phone))fail('Check the phone number.');s.deliveries.unshift(d);break;}
 case 'updateDelivery': {const d=s.deliveries.find(x=>x.id===p.id)||fail('Delivery not found.');if(me.role!=='manager'&&d.driverId!==me.id)fail('You can only update your own deliveries.');if(typeof p.paid==='boolean')d.paid=p.paid;if(p.status){if(!['pending','enroute','delivered','failed'].includes(p.status))fail('Invalid delivery status.');d.status=p.status;}break;}
 case 'settings':manager();s.settings={base:money(p.base),perKm:money(p.perKm)};break;
 case 'sample': {manager();if(s.sample)fail('Examples are already loaded.');const ds=[['Aoife Murphy','aoife'],['Liam O’Brien','liam'],['Sarah Kelly','sarah']].map(([name,n])=>({id:id(),name,email:n+'@example.test',role:'driver',sample:true}));s.drivers.push(...ds);[me,...ds].forEach(d=>{for(let i=0;i<5;i++)s.availability.push({id:id(),driverId:d.id,date:nextDay(i),start:'09:00',end:'23:00',locations:['Dublin City','Rathmines','Dún Laoghaire'],sample:true})});for(let i=0;i<5;i++)s.shifts.push({id:id(),date:nextDay(i%3),start:i%2?'17:00':'10:00',end:i%2?'22:00':'15:00',location:['Dublin City','Rathmines','Dún Laoghaire'][i%3],driverId:i===2?null:[me,...ds][i%4].id,status:i===2?'open':'assigned',sample:true});[['Emma Wilson','12 Camden Street, Dublin 2','D02X285','enroute',false,4.2],['James O’Connor','48 Rathmines Road, Dublin 6','D06F2P8','pending',false,6.5],['Sophie Byrne','8 Portobello Road, Dublin 8','D08A9X3','pending',true,3.1],['Noah Walsh','22 Baggot Street, Dublin 2','D02H638','delivered',true,2.4],['Grace Ryan','5 South William Street, Dublin 2','D02DA31','delivered',true,1.8]].forEach(([name,address,eircode,status,paid,km])=>s.deliveries.push({id:id(),driverId:me.id,date:day(),name,address,eircode,phone:'',status,paid,km,fee:money(s.settings.base+km*s.settings.perKm),notes:'Example delivery',sample:true}));s.sample=true;break;}
 case 'clearSample':manager();for(const k of ['drivers','shifts','availability','deliveries'])s[k]=s[k].filter(x=>!x.sample);for(const sh of s.shifts){if(sh.driverId&&!s.drivers.some(d=>d.id===sh.driverId)){sh.driverId=null;sh.status='open'}}s.deliveries=s.deliveries.map(d=>s.drivers.some(x=>x.id===d.driverId)?d:{...d,driverId:me.id});s.requests=s.requests.filter(r=>s.shifts.some(sh=>sh.id===r.shiftId)&&s.drivers.some(d=>d.id===r.driverId));s.sample=false;break;
 default:fail('Unknown action.');
 }
 return s;
}
export function extractDocket(text){
 const eircode=(text.toUpperCase().match(/\b(?:[AC-FHKNPRTV-Y]\d{2}|D6W)\s?[0-9AC-FHKNPRTV-Y]{4}\b/)||[''])[0];
 const phone=(text.match(/(?:\+353|00353|0)[\d ()\-]{7,18}\d/)||[''])[0].trim();
 const lines=text.split(/\n/).map(x=>x.trim()).filter(Boolean);
 const address=lines.filter(l=>!/(?:total|subtotal|vat|order|receipt|docket|tel:|phone:|€|paid|cash|card)/i.test(l)&&!l.includes(phone||'\u0000'));
 const first=address.findIndex(l=>/\d+\s+[A-Za-z]|street|road|avenue|estate|park|lane|drive|dublin|cork|galway/i.test(l));
 return {eircode,phone,name:lines.find(l=>/^(?:name|customer|deliver to)\s*:/i.test(l))?.replace(/^[^:]+:\s*/,'')||(first>0?address[first-1]:''),address:first>=0?address.slice(first,first+3).join(', ').replace(eircode,'').replace(/,\s*$/,''):''};
}
