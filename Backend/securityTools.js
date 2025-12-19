import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export function runGitleaks(repoPath) {
  try {
    // gitleaks must be installed on the machine or available in PATH
    // run with json output
    const out = execSync(`gitleaks detect --source="${repoPath}" --report-format=json`, { encoding: 'utf-8', stdio: ['ignore','pipe','ignore'] });
    // gitleaks outputs a JSON array
    try { return { success: true, findings: JSON.parse(out) }; } catch(e) { return { success: false, error: 'parse_error' }; }
  } catch (e) {
    // If gitleaks not installed or fails, return the error string
    return { success: false, error: e.message };
  }
}

export function generateSBOM(repoPath, outDir) {
  try {
    // Ensure cyclonedx-bom or cyclonedx-npm installed; use npx to run if not globally installed
    const outFile = path.join(outDir || repoPath, 'bom.json');
    execSync(`npx @cyclonedx/cyclonedx-npm -o ${outFile}`, { cwd: repoPath, stdio: ['ignore','pipe','ignore'] });
    if (fs.existsSync(outFile)) {
      const content = fs.readFileSync(outFile, 'utf-8');
      return { success: true, path: outFile, content: content };
    }
    return { success: false, error: 'sbom_not_generated' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export function computeEntropy(s) {
  try {
    if (!s || typeof s !== 'string') return 0;
    const map = new Map();
    for (const ch of s) map.set(ch, (map.get(ch) || 0) + 1);
    const len = s.length;
    let entropy = 0;
    for (const v of map.values()) {
      const p = v / len;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  } catch (e) {
    return 0;
  }
}
