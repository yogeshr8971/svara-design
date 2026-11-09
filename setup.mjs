// One-command setup:  node setup.mjs
// Checks Node, installs backend + frontend dependencies, creates backend/.env with
// freshly generated secrets (JWT, OTP, VAPID push keys). Safe to re-run.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { randomBytes, generateKeyPairSync } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const skipInstall = process.argv.includes('--skip-install');
const log = (m) => console.log(`\n▶ ${m}`);

const major = Number(process.versions.node.split('.')[0]);
if (major < 18) { console.error(`Node ${process.versions.node} is too old. Install Node 20 or 22 LTS from nodejs.org.`); process.exit(1); }
if (/onedrive/i.test(root)) {
  console.warn('\n⚠ This folder is inside OneDrive. OneDrive can corrupt node_modules.\n  Move the project to e.g. C:\\dev\\svara3 and run this again if you see install errors.');
}

const install = (dir) => {
  log(`Installing dependencies in ${dir} (this takes a few minutes)…`);
  const cwd = path.join(root, dir);
  rmSync(path.join(cwd, 'node_modules'), { recursive: true, force: true });
  rmSync(path.join(cwd, 'package-lock.json'), { force: true });
  try { execSync('npm install', { cwd, stdio: 'inherit' }); }
  catch { console.error(`\n✖ npm install failed in ${dir}. Fix the error above, then re-run: node setup.mjs`); process.exit(1); }
  const bin = path.join(cwd, 'node_modules', '.bin');
  if (!existsSync(bin)) { console.error(`✖ ${dir}: node_modules/.bin missing — install did not complete.`); process.exit(1); }
};
if (!skipInstall) { install('backend'); install('frontend'); install('admin'); }

// --- admin .env ---
const adminEnvPath = path.join(root, 'admin', '.env');
const adminExamplePath = path.join(root, 'admin', '.env.example');
if (!existsSync(adminEnvPath) && existsSync(adminExamplePath)) {
  copyFileSync(adminExamplePath, adminEnvPath);
}

// --- .env ---
const envPath = path.join(root, 'backend', '.env');
const examplePath = path.join(root, 'backend', '.env.example');
if (!existsSync(envPath) || readFileSync(envPath, 'utf8').trim() === '') copyFileSync(examplePath, envPath);
let env = readFileSync(envPath, 'utf8');

const b64url = (b) => Buffer.from(b).toString('base64url');
const vapid = () => {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pub = publicKey.export({ format: 'jwk' });
  const prv = privateKey.export({ format: 'jwk' });
  const x = Buffer.from(pub.x, 'base64url'), y = Buffer.from(pub.y, 'base64url');
  return { pub: b64url(Buffer.concat([Buffer.from([4]), x, y])), prv: prv.d };
};

const setIfEmpty = (key, value) => {
  const re = new RegExp(`^${key}=(.*)$`, 'm');
  const m = env.match(re);
  if (m && m[1].trim() && !/^(your_|change|replace|<)/i.test(m[1].trim())) return false;
  env = m ? env.replace(re, `${key}=${value}`) : env + `\n${key}=${value}`;
  return true;
};
const made = [];
if (setIfEmpty('JWT_SECRET', randomBytes(48).toString('hex'))) made.push('JWT_SECRET');
if (setIfEmpty('OTP_SECRET', randomBytes(32).toString('hex'))) made.push('OTP_SECRET');
if (!/^VAPID_PUBLIC_KEY=\S+/m.test(env)) {
  const k = vapid();
  env = env.replace(/^VAPID_PUBLIC_KEY=.*$/m, `VAPID_PUBLIC_KEY=${k.pub}`).replace(/^VAPID_PRIVATE_KEY=.*$/m, `VAPID_PRIVATE_KEY=${k.prv}`);
  made.push('VAPID keys');
}
setIfEmpty('CLIENT_URL', 'http://localhost:5173');
setIfEmpty('ADMIN_URL', 'http://localhost:5174');
writeFileSync(envPath, env);

log('Done.');
console.log(`Generated: ${made.join(', ') || 'nothing new (already set)'}`);
console.log(`
Still to fill in by hand in backend/.env:
  MONGODB_URI      (MongoDB Atlas connection string)
  ADMIN_EMAIL, ADMIN_PASSWORD
  CLOUDINARY_*, RAZORPAY_*, GEMINI_API_KEY   (when you test uploads / payments / AI try-on)

Then run (three terminals):
  cd backend  && npm run dev
  cd frontend && npm run dev
  cd admin    && npm run dev
`);
