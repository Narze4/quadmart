import { SafetyError } from '@/lib/server/safety.mjs'
import { backend } from '@/lib/server/firebase-admin.mjs'
import { operate, MarketError } from '@/lib/server/market.mjs'
export const runtime = 'nodejs'
export async function POST(request) {
  try {
    const bearer=request.headers.get('authorization');
    if(!bearer?.startsWith('Bearer ')) return Response.json({error:'Sign in required'},{status:401});
    const {auth,db}=backend();
    let actor;
    try {actor=await auth.verifyIdToken(bearer.slice(7),true)} catch {return Response.json({error:'Invalid or expired sign-in'},{status:401})}
    if(Number(request.headers.get('content-length'))>12000) return Response.json({error:'Request too large'},{status:413});
    const reader=request.body?.getReader();
    if(!reader) return Response.json({error:'Invalid request'},{status:400});
    const chunks=[];let bytes=0;
    try {
      while(true) {
        const {done,value}=await reader.read();if(done) break;
        bytes+=value.byteLength;
        if(bytes>12000){await reader.cancel();return Response.json({error:'Request too large'},{status:413})}
        chunks.push(value);
      }
    } finally {reader.releaseLock()}
    const raw=Buffer.concat(chunks,bytes).toString('utf8');
    let body;try{body=JSON.parse(raw)}catch{return Response.json({error:'Invalid JSON'},{status:400})}
    if(!body || typeof body.data!=='object' || !body.data || Array.isArray(body.data)) return Response.json({error:'Invalid request'},{status:400});
    const result=await operate(db,actor,body.action,body.data);
    return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) {
    if(error instanceof MarketError || error instanceof SafetyError) return Response.json({error:error.message},{status:error.status});
    console.error('Marketplace operation failed',error);
    return Response.json({error:'Unable to complete this action. Please retry.'},{status:500});
  }
}
