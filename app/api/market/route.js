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
    const raw=await request.text();
    if(raw.length>12000) return Response.json({error:'Request too large'},{status:413});
    let body;try{body=JSON.parse(raw)}catch{return Response.json({error:'Invalid JSON'},{status:400})}
    if(!body || typeof body.data!=='object' || !body.data || Array.isArray(body.data)) return Response.json({error:'Invalid request'},{status:400});
    const result=await operate(db,actor,body.action,body.data);
    return Response.json(result);
  } catch(error) {
    if(error instanceof MarketError) return Response.json({error:error.message},{status:error.status});
    console.error('Marketplace operation failed',error);
    return Response.json({error:'Unable to complete this action. Please retry.'},{status:500});
  }
}
