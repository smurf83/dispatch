import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { fresh, member, view, mutate } from '../../../lib/domain.mjs';
export const dynamic = 'force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function context(){
 const u=await getChatGPTUser();if(!u)return {error:json({error:'Please sign in to your workspace.'},401)};
 if(!env.DB)return {error:json({error:'Database is not configured.'},503)};
 const user={...u,name:u.fullName||u.email};
 let row=await env.DB.prepare('SELECT data, revision FROM workspace WHERE id = ?').bind('main').first<{data:string,revision:number}>();
 if(!row){await env.DB.prepare('INSERT OR IGNORE INTO workspace (id, revision, data) VALUES (?, 0, ?)').bind('main',JSON.stringify(fresh(user))).run();row=await env.DB.prepare('SELECT data, revision FROM workspace WHERE id = ?').bind('main').first<{data:string,revision:number}>();}
 const state=JSON.parse(row!.data);const me=member(state,user);
 if(!me)return {error:json({error:'Your email is not on this team. Ask the manager to add '+u.email+'.'},403)};
 return {state,me,revision:row!.revision};
}
export async function GET(){try{const c=await context();if(c.error)return c.error;return json({state:view(c.state,c.me),revision:c.revision});}catch(e){console.error(e);return json({error:'Unable to load the workspace. Please try again.'},500)}}
export async function POST(request:Request){
 try{
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
 if(Number(request.headers.get('content-length')||0)>25000)return json({error:'Request too large.'},413);
 const c=await context();if(c.error)return c.error;
 const b:any=await request.json();if(b.revision!==c.revision)return json({error:'Workspace changed. Your view has been refreshed; please try again.'},409);
 mutate(c.state,c.me,b.action,b.payload);
 const result=await env.DB!.prepare('UPDATE workspace SET data = ?, revision = revision + 1 WHERE id = ? AND revision = ?').bind(JSON.stringify(c.state),'main',c.revision).run();
 if(result.meta.changes!==1)return json({error:'Workspace changed. Please try again.'},409);
 return json({state:view(c.state,c.me),revision:c.revision!+1});
 }catch(e){return json({error:e instanceof Error?e.message:'Unable to save changes.'},400)}
}
