import sharp from 'sharp';
import { rootName, digest } from '../lib/operations/backup.mjs';
import { expectedPublicId } from '../lib/operations/recovery-schema.mjs';
export const account = () => ({ uid:'recovery-fixture', email:'recovery@example.edu', emailVerified:true, disabled:false, providerData:[{providerId:'password',uid:'recovery@example.edu',email:'recovery@example.edu'}], passwordHash:Buffer.from('synthetic-hash').toString('base64'),passwordSalt:Buffer.from('salt').toString('base64'),metadata:{creationTime:'Wed, 28 Oct 2026 00:00:00 GMT',lastSignInTime:'Wed, 28 Oct 2026 00:00:00 GMT'},customClaims:{student:true} });
export const hashConfig = () => ({algorithm:'SCRYPT',signerKey:Buffer.alloc(32,1).toString('base64'),saltSeparator:'Bw==',rounds:8,memoryCost:14});
export async function fixture() {
 const mediaId='a'.repeat(64),ownerUid=account().uid;
 const publicId=expectedPublicId('quadmart-development',ownerUid,mediaId);
 const fields=Object.fromEntries(Object.entries({ownerUid,publicId,status:'ready'}).map(([k,stringValue])=>[k,{stringValue}]));
 const documents=[{name:`${rootName('quadmart-development')}/media/${mediaId}`,fields}];
 const snapshot={version:1,kind:'firestore-documents',projectId:'quadmart-development',capturedAt:new Date().toISOString(),readTime:new Date().toISOString(),documents,documentCount:1,checksum:digest(documents)};
 const bytes=await sharp({create:{width:16,height:16,channels:3,background:'#258f52'}}).jpeg().toBuffer();
 const services={auth:{listUsers:async()=>({users:[account()]})},authConfiguration:async()=>({signIn:{hashConfig:hashConfig()}}),downloadPhoto:async()=>({bytes})};
 return {snapshot,services,bytes};
}
