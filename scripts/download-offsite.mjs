import fs from 'node:fs/promises';
import path from 'node:path';
import { privateDirectory } from '../lib/operations/backup.mjs';
import { backupFilename } from '../lib/operations/offsite.mjs';
import { sha256 } from '../lib/operations/recovery-schema.mjs';
// The connector's authenticated temporary download URL lives in a private
// input file, never in argv or logs. TLS verification stays enabled.
const input=process.argv[2],directory=process.argv[3];
try {
 const stat=await fs.lstat(input);if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077))throw Error();
 const {downloadUrl,filename,bytes}=JSON.parse(await fs.readFile(input,'utf8'));
 const url=new URL(downloadUrl);
 if(url.protocol!=='https:'||!url.hostname.endsWith('.oaiusercontent.com')||url.username||url.password||url.port||!backupFilename(filename)||!Number.isSafeInteger(bytes)||bytes<=0||bytes>90*1024*1024)throw Error();
 await privateDirectory(directory);
 const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error();
 const reader=response.body.getReader(),parts=[];let length=0;
 try{while(true){const next=await reader.read();if(next.done)break;length+=next.value.length;if(length>bytes){await reader.cancel();throw Error();}parts.push(next.value);}}finally{reader.releaseLock();}
 if(length!==bytes)throw Error();const data=Buffer.concat(parts,length),file=path.join(directory,filename),temp=`${file}.partial`;
 const handle=await fs.open(temp,'wx',0o600);try{await handle.writeFile(data);await handle.sync();}finally{await handle.close();}
 await fs.rename(temp,file);console.log(JSON.stringify({status:'success',filename,bytes:length,sha256:sha256(data)}));
}catch{console.error(JSON.stringify({status:'failed',stage:'offsite_download'}));process.exitCode=1;}
finally{if(input)try{await fs.unlink(input);}catch{/* Caller removes a stale input on a failed launch. */}}
