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

  if (Object.keys(metadata.services).length > 0) {
    const servicesBlocks = [];
    for (const [serviceName, svc] of Object.entries(metadata.services)) {
      const portPart = svc.port ? `\n      ports:\n        - \"${svc.port}:${svc.port}\"` : "";
      servicesBlocks.push(`  ${serviceName}:\n    build: ./infra/${serviceName}\n    container_name: ${serviceName}${portPart}`);
    }
    output.generatedContent.dockerCompose = `version: '3.8'\nservices:\n${servicesBlocks.join("\n\n")}`;

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

    const scanMeta = scanRepo(repoPath);
    for (const [name, svc] of Object.entries(scanMeta.services || {})) {
      const label = svc.port ? `${name} (${svc.port})` : name;
      const safe = makeSafeId(name);
      const escLabel = String(label).replace(/"/g, '\\"');
      nodes.add(`${safe}["${escLabel}"]`);
      edges.add(`Server-->${safe}`);
    }

    const meta = scanMeta; 
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