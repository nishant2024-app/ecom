import { TokenService } from '../services/tokens';

const pem = await TokenService.generateKeyPem();
const kid = `k${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`;
console.log('Add this to JWT_PRIVATE_KEYS (keep it secret, store it in SOPS):\n');
console.log(`JWT_PRIVATE_KEYS='${JSON.stringify([{ kid, privateKeyPem: pem }])}'`);
