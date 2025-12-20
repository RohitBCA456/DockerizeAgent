// tools/repoScanner.js

import fs from "fs";
import path from "path";

// A generic function to recursively find files matching a pattern
function findFiles(dir, pattern, filelist = []) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (['node_modules', '.git', 'dist', 'build'].includes(file)) {
      return;
    }
    if (fs.statSync(filePath).isDirectory()) {
      findFiles(filePath, pattern, filelist);
    } else if (pattern.test(file)) {
      filelist.push(filePath);
    }
  });
  return filelist;
}

// The main scanning function, now with service structure detection
export function scanRepo(repoPath) {
  const metadata = {
    services: {},
    requiredServices: new Set(),
    type: "unknown",
  };

  // --- 1. Detect Project Structure (Services) ---
  // We find all package.json files, as each one typically represents a service.
  const packageJsonFiles = findFiles(repoPath, /package\.json$/);
  
  for (const pjsonPath of packageJsonFiles) {
    try {
      const pjsonContent = JSON.parse(fs.readFileSync(pjsonPath, "utf-8"));
      // Ignore packages with no name (can be workspace configs)
      if (!pjsonContent.name) continue;

      // Use the directory name as the service name for clarity (e.g., 'api', 'frontend')
      // but fall back to the package name if needed.
      const servicePath = path.dirname(pjsonPath);
      const serviceName = path.basename(servicePath);

      metadata.services[serviceName] = {
        name: pjsonContent.name,
        path: servicePath,
        entryPoint: pjsonContent.main || "index.js", // Best guess for entry point
        dependencies: Object.keys(pjsonContent.dependencies || {}),
        port: null,
      };
      console.log(`[SCANNER] Detected Service: '${serviceName}' at ${servicePath}`);
    } catch (e) {
      console.error(`Error processing package.json at ${pjsonPath}:`, e);
    }
  }

  // --- 2. Check Dependencies for Required Auxiliary Services ---
  // Broaden checks to look at devDependencies too and multiple common package names.
  const serviceSignatures = [
    { name: 'MongoDB', matches: ['mongoose', 'mongodb'] },
    { name: 'Redis', matches: ['redis', 'ioredis', 'connect-redis'] },
    { name: 'PostgreSQL', matches: ['pg', 'pg-native', 'pg-promise'] },
    { name: 'MySQL', matches: ['mysql', 'mysql2'] },
    { name: 'RabbitMQ', matches: ['amqplib', 'amqp', 'rascal'] },
    { name: 'Kafka', matches: ['kafka-node', 'kafkajs', 'node-rdkafka'] },
    { name: 'Elasticsearch', matches: ['elasticsearch', '@elastic/elasticsearch'] },
    { name: 'Memcached', matches: ['memcached'] },
  ];

  for (const service of Object.values(metadata.services)) {
    // gather deps and devDeps from package.json
    let deps = (service.dependencies || []).slice();
    try {
      const pjsonPath = path.join(service.path, 'package.json');
      if (fs.existsSync(pjsonPath)) {
        const pj = JSON.parse(fs.readFileSync(pjsonPath, 'utf-8'));
        deps = deps.concat(Object.keys(pj.devDependencies || {}));
      }
    } catch (e) { /* ignore */ }

    for (const sig of serviceSignatures) {
      if (deps.some(d => sig.matches.some(m => d && d.toLowerCase().includes(m)))) {
        metadata.requiredServices.add(sig.name);
      }
    }
  }

  // --- 3. Scan .env Files (for additional clues) ---
  const envFiles = findFiles(repoPath, /\.env(\..*)?$/);
  // (Regex checks for env files remain the same, they just add to the Set)
  for (const file of envFiles) {
    try {
        const content = fs.readFileSync(file, "utf-8");
  // env-based hints for common services
  if (/mongodb(?:\+srv)?:\/\//i.test(content) || /^(MONGO|MONGODB|DATABASE)_?URI\s*=\s*/im.test(content)) metadata.requiredServices.add("MongoDB");
  if (/redis:\/\//i.test(content) || /^(REDIS(_URL|_HOST|_PORT)?)/im.test(content)) metadata.requiredServices.add("Redis");
  if (/postgres(?:ql)?:\/\//i.test(content) || /(POSTGRES|POSTGRESQL|DATABASE)_?URL|DATABASE_URL/i.test(content)) metadata.requiredServices.add("PostgreSQL");
  if (/mysql:\/\//i.test(content) || /^(MYSQL|MYSQL2|DATABASE)_?URL/i.test(content)) metadata.requiredServices.add("MySQL");
  if (/amqp:\/\//i.test(content) || /RABBITMQ|AMQP(_URL)?/i.test(content)) metadata.requiredServices.add("RabbitMQ");
        // Detect port definitions like PORT=3000 or APP_PORT=4000
        const portMatch = content.match(/(^|\n)\s*(?:PORT|APP_PORT|SERVER_PORT)\s*=\s*(\d{2,5})/i);
        if (portMatch) {
          // Attach to the first service that doesn't already have a port
          for (const svc of Object.values(metadata.services)) {
            if (!svc.port) {
              svc.port = parseInt(portMatch[2], 10);
              break;
            }
          }
        }
    } catch (e) { /* Ignore read errors */ }
  }

  // --- 4. Scan File Content (Fallback) ---
  const jsFiles = findFiles(repoPath, /\.(js|mjs|ts)$/);
  for (const file of jsFiles) {
    try {
        const content = fs.readFileSync(file, "utf-8");
  // connection string and SDK usage hints
  if (/mongodb(?:\+srv)?:\/\//i.test(content) || /\bmongoose\b/i.test(content)) metadata.requiredServices.add("MongoDB");
  if (/redis:\/\//i.test(content) || /\bioredis\b|\bredis\b/i.test(content)) metadata.requiredServices.add("Redis");
  if (/postgres(?:ql)?:\/\//i.test(content) || /\bpg\b|\bpg-promise\b/i.test(content)) metadata.requiredServices.add("PostgreSQL");
  if (/mysql:\/\//i.test(content) || /\bmysql2?\b/i.test(content)) metadata.requiredServices.add("MySQL");
  if (/amqp:\/\//i.test(content) || /\bamqplib\b|\brabbitmq\b/i.test(content)) metadata.requiredServices.add("RabbitMQ");
  if (/kafka:\/\//i.test(content) || /\bkafka-node\b|\bkafkajs\b/i.test(content)) metadata.requiredServices.add("Kafka");
  if (/elastic(?:search)?/i.test(content) || /\belasticsearch\b/i.test(content)) metadata.requiredServices.add("Elasticsearch");
        // Try to extract literal ports from app.listen(3000) or app.listen(process.env.PORT || 3000)
        const listenMatch = content.match(/app\.listen\s*\(\s*(?:process\.env\.(?:PORT|APP_PORT)\s*\|\|\s*)?(\d{2,5})/i);
        if (listenMatch) {
          // assign port to the nearest service by path (heuristic)
          const dir = path.dirname(file);
          let assigned = false;
          for (const svc of Object.values(metadata.services)) {
            if (!svc.port && dir.startsWith(svc.path)) {
              svc.port = parseInt(listenMatch[1], 10);
              assigned = true;
              break;
            }
          }
          if (!assigned) {
            // fallback: assign to first service without a port
            for (const svc of Object.values(metadata.services)) {
              if (!svc.port) { svc.port = parseInt(listenMatch[1], 10); break; }
            }
          }
        }
    } catch (e) { /* Ignore read errors */ }
  }
  
  // --- Finalize Metadata ---
  metadata.requiredServices = Array.from(metadata.requiredServices);

  // The project type detection will now work correctly
  const serviceCount = Object.keys(metadata.services).length;
  if (serviceCount > 1) {
    metadata.type = "microservices";
  } else if (serviceCount === 1) {
    metadata.type = "monolith";
  }

  console.log('[SCANNER] Final Metadata:', JSON.stringify(metadata, null, 2));
  return metadata;
}