import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { scanRepo } from "./tools/repoScanner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function loadTemplate(name) {
  const tplPath = path.join(__dirname, "templates", name);
  return fs.existsSync(tplPath) ? fs.readFileSync(tplPath, "utf-8") : "";
}

export function generateFromRepo(repoPath) {
  const metadata = scanRepo(repoPath);
  const output = {
    metadata,
    generatedContent: {
      dockerfiles: {},
      dockerCompose: null,
      ciCdPipeline: null,
      kubernetes: {},
      // security report generation removed per user request
    },
  };

  // Render Dockerfiles
  for (const [serviceName, svc] of Object.entries(metadata.services)) {
    const tpl = loadTemplate("node-dockerfile.hbs");
    if (tpl) {
      const renderer = Handlebars.compile(tpl);
      output.generatedContent.dockerfiles[serviceName] = renderer({ 
        serviceName, 
        entryPoint: svc.entryPoint || "index.js", 
        port: svc.port || 3000 
      });
    }
  }

  // Security audit and report generation removed per user request

  // Generate docker-compose content if services found
  if (Object.keys(metadata.services).length > 0) {
    const servicesBlocks = [];
    for (const [serviceName, svc] of Object.entries(metadata.services)) {
      const portPart = svc.port ? `\n      ports:\n        - \"${svc.port}:${svc.port}\"` : "";
      servicesBlocks.push(`  ${serviceName}:\n    build: ./infra/${serviceName}\n    container_name: ${serviceName}${portPart}`);
    }
    output.generatedContent.dockerCompose = `version: '3.8'\nservices:\n${servicesBlocks.join("\n\n")}`;

    // Kubernetes manifests (basic deployment + service) per service
    for (const [serviceName, svc] of Object.entries(metadata.services)) {
      const port = svc.port || 3000;
      const deploy = `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${serviceName}-deployment\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: ${serviceName}\n  template:\n    metadata:\n      labels:\n        app: ${serviceName}\n    spec:\n      containers:\n        - name: ${serviceName}\n          image: ${serviceName}:latest\n          ports:\n            - containerPort: ${port}\n`;
      const svcManifest = `apiVersion: v1\nkind: Service\nmetadata:\n  name: ${serviceName}-svc\nspec:\n  selector:\n    app: ${serviceName}\n  ports:\n    - protocol: TCP\n      port: ${port}\n      targetPort: ${port}\n  type: ClusterIP\n`;
      output.generatedContent.kubernetes[serviceName] = {
        deployment: deploy,
        service: svcManifest,
      };
    }
  }
  return output;
}

export function generateArchitectureMermaid(repoPath) {
  const nodes = new Set(['Client["Web Client"]', 'Server["Express Server"]']);
  const edges = new Set(['Client-->Server']);

  const makeSafeId = (s) => {
    if (!s || typeof s !== 'string') return 'node';
    let id = s.replace(/[^a-zA-Z0-9_]/g, '_');
    if (/^[0-9]/.test(id)) id = 's_' + id;
    return id || 'node';
  };

  function deepScan(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        const name = item.toLowerCase();
        if (['models', 'database', 'db'].includes(name)) {
          nodes.add('DB[("MongoDB/Database")]');
          edges.add('Server-->DB');
        }
        if (['routes', 'controllers', 'api'].includes(name)) {
          nodes.add('Endpoints["API Routes"]');
          edges.add('Server-->Endpoints');
        }
        if (!['node_modules', '.git', 'infra'].includes(item)) deepScan(fullPath);
      }
    }
  }

  try {
    deepScan(repoPath);

    // Add explicit service nodes (with ports) if available
    const scanMeta = scanRepo(repoPath);
    for (const [name, svc] of Object.entries(scanMeta.services || {})) {
      const label = svc.port ? `${name} (${svc.port})` : name;
      const safe = makeSafeId(name);
      const escLabel = String(label).replace(/"/g, '\\"');
      nodes.add(`${safe}["${escLabel}"]`);
      edges.add(`Server-->${safe}`);
    }

    // Add required services like MongoDB as separate nodes
    const meta = scanMeta; // already scanned above
    if (meta.requiredServices && meta.requiredServices.length) {
      meta.requiredServices.forEach(rs => {
        const nodeKey = makeSafeId(rs);
        const esc = String(rs).replace(/"/g, '\\"');
        nodes.add(`${nodeKey}["${esc}"]`);
        edges.add(`Server-->${nodeKey}`);
      });
    }

    return `graph TD;\n  ${Array.from(nodes).join(';\n  ')};\n  ${Array.from(edges).join(';\n  ')};`;
  } catch (e) {
    return 'graph TD; Client-->Server; Server-->Database;';
  }
}

// security report generation removed

/**
 * Generates a deterministic STRIDE-like threat model report based on repo metadata.
 * Returns a Markdown string describing threats and mitigations.
 */
export function generateThreatModel(repoPath) {
  const meta = scanRepo(repoPath);
  const services = meta.services || {};
  const required = meta.requiredServices || [];

  const lines = [];
  lines.push('# Threat Model & Risk Report');
  lines.push('This report is generated deterministically from repository metadata and simple heuristics.');
  lines.push('');

  // STRIDE categories
  const stride = ['Spoofing', 'Tampering', 'Repudiation', 'Information Disclosure', 'Denial of Service', 'Elevation of Privilege'];

  lines.push('## Summary');
  lines.push(`- Services detected: ${Object.keys(services).length}`);
  lines.push(`- Infrastructure: ${required.join(', ') || 'None detected'}`);
  lines.push('');

  // We'll collect overall vuln totals
  let totalCritical = 0;
  let totalHigh = 0;

  for (const [svcName, svc] of Object.entries(services)) {
    lines.push(`### Service: ${svcName}`);
    lines.push(`- Path: ${svc.path}`);
    lines.push(`- Port: ${svc.port || 'N/A'}`);
    const publicExposure = svc.port ? 'Likely externally reachable' : 'Not externally reachable (no port detected)';
    lines.push(`- Exposure: ${publicExposure}`);
    lines.push('');

    // Run npm audit to find critical/high counts (best-effort)
    try {
      if (fs.existsSync(path.join(svc.path, 'package.json'))) {
        const proc = spawnSync(npmCmd, ['audit', '--json'], { cwd: svc.path, encoding: 'utf-8', shell: true });
        if (proc.stdout) {
          try {
            const aud = JSON.parse(proc.stdout);
            const vuln = aud.metadata?.vulnerabilities || aud.vulnerabilities || {};
            const c = vuln.critical || 0;
            const h = vuln.high || 0;
            totalCritical += c;
            totalHigh += h;
            lines.push(`- Vulnerabilities: **Critical:** ${c}  **High:** ${h}`);
          } catch (e) {
            // ignore parse errors
            lines.push('- Vulnerabilities: audit unavailable');
          }
        }
      }
    } catch (e) { /* ignore */ }


    // For each STRIDE category, apply simple heuristics
    lines.push('#### Threats');
    // Spoofing
    if (svc.dependencies && svc.dependencies.includes('passport')) {
      lines.push('- **Spoofing**: Authentication libraries present — ensure strong session cookie settings and MFA where possible.');
    } else {
      lines.push('- **Spoofing**: No authentication dependency detected — service may be unauthenticated. Consider adding authentication (OAuth, JWT, etc.).');
    }

    // Tampering
    lines.push('- **Tampering**: Ensure input validation and use of parameterized queries to avoid injection.');

    // Repudiation
    lines.push('- **Repudiation**: Add centralized audit logging (immutable logs) for critical operations.');

    // Information Disclosure
    if (required.includes('MongoDB') || svc.dependencies.some(d => /mongo/i.test(d))) {
      lines.push('- **Information Disclosure**: Database detected — ensure credentials are not in repo, use TLS for DB connections, and enforce least privilege DB users.');
    } else {
      lines.push('- **Information Disclosure**: No DB detected — still ensure secrets are not checked into source.');
    }

    // DoS
    if (svc.port) lines.push('- **Denial of Service**: Public endpoints detected; add rate-limiting and request throttling.');
    else lines.push('- **Denial of Service**: Service is not directly exposed but may be affected by upstream DoS.');

    // Elevation of Privilege
    lines.push('- **Elevation of Privilege**: Check for insecure default credentials, overly permissive file permissions, and avoid `eval()` in code.');

    lines.push('');
    lines.push('#### Mitigations');
    lines.push('- Use TLS for all external endpoints and DB connections.');
    lines.push('- Enforce least privilege for database accounts and service accounts.');
    lines.push('- Rotate secrets and use a secrets manager (Vault, AWS Secrets Manager).');
    lines.push('- Add rate-limiting, WAF, and health checks for public services.');
    lines.push('- Add monitoring and alerting (Prometheus/Grafana, Sentry).');
    lines.push('');
  }

  // Insert overall vulnerability summary
  lines.splice(3, 0, `- **Total Critical Vulnerabilities:** ${totalCritical}`, `- **Total High Vulnerabilities:** ${totalHigh}`, '');

  // Global recommendations
  lines.push('## Global Recommendations');
  lines.push('- Run dependency vulnerability scans and fix critical/high issues.');
  lines.push('- Add automated security tests to CI.');
  lines.push('- Perform periodic penetration tests and disaster recovery drills.');

  const md = lines.join('\n');
  return { markdown: md, totals: { critical: totalCritical, high: totalHigh } };
}

/**
 * Generates a deterministic Failure & Recovery (Disaster Recovery) Plan based on repo metadata.
 * Returns a Markdown string describing recovery steps.
 */
export function generateDisasterRecoveryPlan(repoPath) {
  const meta = scanRepo(repoPath);
  const services = meta.services || {};

  const lines = [];
  lines.push('# Failure & Recovery Plan');
  lines.push('This plan is generated deterministically using repository heuristics. Validate and adapt before use.');
  lines.push('');

  lines.push('## Service Recovery Summary');
  for (const [svcName, svc] of Object.entries(services)) {
    const isStateful = (svc.dependencies || []).some(d => /mongo|redis|pg|mysql|postgres/i.test(d));
    lines.push(`### ${svcName}`);
    lines.push(`- Path: ${svc.path}`);
    lines.push(`- Stateful: ${isStateful ? 'Yes' : 'No'}`);
    lines.push(`- Recommended replicas: ${isStateful ? 1 : 2}`);
    lines.push(`- Backup: ${isStateful ? 'Required (DB backups, point-in-time if available)' : 'Not required for ephemeral service data (stateless)'} `);
    lines.push('');
    lines.push('#### Recovery Steps');
    lines.push('- Ensure automated backups for databases (daily snapshots + WAL/archive for PITR).');
    lines.push('- Use infrastructure as code (Terraform/CloudFormation) for fast rebuilds.');
    lines.push('- Maintain container images in a private registry and tag with semantic versions.');
    lines.push('- Implement health checks and readiness probes; use liveness probes to restart unhealthy containers.');
    lines.push('- Document runbooks with step-by-step restore procedures and point-of-contact details.');
    lines.push('');
  }

  lines.push('## Disaster Recovery Playbook (Generic)');
  lines.push('1. Detect and contain: isolate affected services and route traffic to healthy instances.');
  lines.push('2. Notify stakeholders and run incident response playbook.');
  lines.push('3. Restore from last valid backup into a recovery environment.');
  lines.push('4. Validate data integrity and promote recovered systems to production only after verification.');
  lines.push('5. Perform post-mortem and update DR runbooks.');

  return lines.join('\n');
}