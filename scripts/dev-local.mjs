import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1'], {
  stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'true', QUADMART_LOCAL: 'true', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' },
});
child.on('exit', code => process.exit(code ?? 1));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
