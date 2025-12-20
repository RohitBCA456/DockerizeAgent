import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import net from 'net';
import { scanRepo } from './tools/repoScanner.js';
import { runGitleaks, generateSBOM } from './securityTools.js';

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => resolve(err.code === 'EADDRINUSE'));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port, '127.0.0.1');
  });
}

export async function runPreflight(repoPath, options = { runGitleaks: false, runSBOM: true }) {
  try {
    const metadata = scanRepo(repoPath);
    const results = { portChecks: [], audits: {}, maintenance: {} };

  const guessedPorts = new Set();

  for (const [svcName, svc] of Object.entries(metadata.services)) {
    const pkgJson = path.join(svc.path, 'package.json');
    if (fs.existsSync(pkgJson)) {
      const proc = spawnSync(npmCmd, ['audit', '--json'], { 
        cwd: svc.path, 
        encoding: 'utf-8', 
        shell: true 
      });
      
      try {
        results.audits[svcName] = proc.stdout ? JSON.parse(proc.stdout) : { error: 'No output' };
      } catch (e) {
        results.audits[svcName] = { error: 'parse_failed', raw: proc.stdout?.substring(0, 200) };
      }
    }
  }

  for (const [svcName, svc] of Object.entries(metadata.services)) {
    const proc = spawnSync(npmCmd, ['outdated', '--json'], { 
      cwd: svc.path, 
      encoding: 'utf-8', 
      shell: true 
    });
    
    try {
      const outdated = proc.stdout ? JSON.parse(proc.stdout) : {};
      const numOutdated = Object.keys(outdated).length;
      results.maintenance[svcName] = {
        outdated,
        numOutdated,
        maintenanceScore: Math.max(0, 100 - (numOutdated * 5))
      };
    } catch (e) {
      results.maintenance[svcName] = { maintenanceScore: 100, outdated: {} };
    }
  }

    if (options.runSBOM) {
      try {
        results.sbom = generateSBOM(repoPath, path.join(repoPath, 'infra'));
      } catch (e) {
        results.sbom = { success: false, error: e.message };
      }
    }
    return results;
  } catch (e) {
    console.error('Preflight failed:', e);
    return { error: e.message || 'preflight_failed', details: e.stack };
  }
}