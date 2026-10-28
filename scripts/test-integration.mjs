import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
const env={...process.env,QUADMART_LOCAL:'true',QUADMART_ENABLE_UPLOADS:'true',NEXT_PUBLIC_USE_FIREBASE_EMULATORS:'true',QUADMART_TEST_BASE:'http://127.0.0.1:3100'};
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3100'],{env,stdio:'inherit'});
try {
 let ready=false;
 for(let i=0;i<60;i++){try{if((await fetch(env.QUADMART_TEST_BASE+'/login')).ok){ready=true;break}}catch{}await setTimeout(500)}
 if(!ready)throw Error('Local Next server did not start');
 const run=spawn(process.execPath,['tests/backend-flow.mjs'],{env,stdio:'inherit'});
 const code=await new Promise(resolve=>run.on('exit',resolve));
 if(code!==0)process.exitCode=1;
}finally{server.kill('SIGTERM')}
