import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
// Read a private note exported from the password manager. Never accept key
// bytes in argv, echo them, or replace an existing recovery key.
try {
 const [note,destination]=process.argv.slice(2);
 if(!note||!destination||!path.isAbsolute(note)||!path.isAbsolute(destination))throw Error();
 const stat=await fs.lstat(note),parent=await fs.lstat(path.dirname(destination));
 if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)||!parent.isDirectory()||parent.isSymbolicLink()||(parent.mode&0o077))throw Error();
 const text=await fs.readFile(note,'utf8'),match=text.match(/QUADMART-RECOVERY-KEY-v1:([A-Za-z0-9+/]{43}=)/);
 if(!match)throw Error();const key=Buffer.from(match[1],'base64');if(key.length!==32)throw Error();
 await fs.writeFile(destination,key,{flag:'wx',mode:0o600});
 console.log(JSON.stringify({status:'success',fingerprint:createHash('sha256').update(key).digest('hex')}));
}catch{console.error(JSON.stringify({status:'failed',message:'Use a private recovery note and an absent destination in a private directory. Key contents are never logged.'}));process.exitCode=1;}
