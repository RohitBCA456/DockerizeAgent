import path from 'path';
import { generateFromRepo } from '../deterministicDevops.js';

const repoPath = path.resolve(process.cwd(), '..');
console.log('Scanning repo:', repoPath);
const output = generateFromRepo(repoPath);
console.log('Services detected:', Object.keys(output.metadata.services));
console.log('Generated dockerfiles:', Object.keys(output.generatedContent.dockerfiles));
console.log('Security report length:', (output.generatedContent.securityReport||'').length);
