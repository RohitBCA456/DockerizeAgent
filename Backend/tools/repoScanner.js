import fs from "fs";
import path from "path";

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

export function scanRepo(repoPath) {
  const metadata = {
    services: {},
    requiredServices: new Set(),
    type: "unknown",
  };

  const packageJsonFiles = findFiles(repoPath, /package\.json$/);
  
  for (const pjsonPath of packageJsonFiles) {
    try {
      const pjsonContent = JSON.parse(fs.readFileSync(pjsonPath, "utf-8"));
      if (!pjsonContent.name) continue;

      const servicePath = path.dirname(pjsonPath);
      const serviceName = path.basename(servicePath);

      metadata.services[serviceName] = {
        name: pjsonContent.name,
        path: servicePath,
        entryPoint: pjsonContent.main || "index.js",
        dependencies: Object.keys(pjsonContent.dependencies || {}),
        port: null,
      };
      console.log(`[SCANNER] Detected Service: '${serviceName}' at ${servicePath}`);
    } catch (e) {
      console.error(`Error processing package.json at ${pjsonPath}:`, e);
    }
  }

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
    let deps = (service.dependencies || []).slice();
    try {
      const pjsonPath = path.join(service.path, 'package.json');
      if (fs.existsSync(pjsonPath)) {
        const pj = JSON.parse(fs.readFileSync(pjsonPath, 'utf-8'));
        deps = deps.concat(Object.keys(pj.devDependencies || {}));
      }
    } catch (e) { }

    for (const sig of serviceSignatures) {
      if (deps.some(d => sig.matches.some(m => d && d.toLowerCase().includes(m)))) {
        metadata.requiredServices.add(sig.name);
      }
    }
  }

  const envFiles = findFiles(repoPath, /\.env(\..*)?$/);
  for (const file of envFiles) {
    try {
        const content = fs.readFileSync(file, "utf-8");
  if (/mongodb(?:\+srv)?:\/\//i.test(content) || /^(MONGO|MONGODB|DATABASE)_?URI\s*=\s*/im.test(content)) metadata.requiredServices.add("MongoDB");
  if (/redis:\/\//i.test(content) || /^(REDIS(_URL|_HOST|_PORT)?)/im.test(content)) metadata.requiredServices.add("Redis");
  if (/postgres(?:ql)?:\/\//i.test(content) || /(POSTGRES|POSTGRESQL|DATABASE)_?URL|DATABASE_URL/i.test(content)) metadata.requiredServices.add("PostgreSQL");
  if (/mysql:\/\//i.test(content) || /^(MYSQL|MYSQL2|DATABASE)_?URL/i.test(content)) metadata.requiredServices.add("MySQL");
  if (/amqp:\/\//i.test(content) || /RABBITMQ|AMQP(_URL)?/i.test(content)) metadata.requiredServices.add("RabbitMQ");
     
        const portMatch = content.match(/(^|\n)\s*(?:PORT|APP_PORT|SERVER_PORT)\s*=\s*(\d{2,5})/i);
        if (portMatch) {
          for (const svc of Object.values(metadata.services)) {
            if (!svc.port) {
              svc.port = parseInt(portMatch[2], 10);
              break;
            }
          }
        }
    } catch (e) {}
  }

  const jsFiles = findFiles(repoPath, /\.(js|mjs|ts)$/);
  for (const file of jsFiles) {
    try {
        const content = fs.readFileSync(file, "utf-8");
  if (/mongodb(?:\+srv)?:\/\//i.test(content) || /\bmongoose\b/i.test(content)) metadata.requiredServices.add("MongoDB");
  if (/redis:\/\//i.test(content) || /\bioredis\b|\bredis\b/i.test(content)) metadata.requiredServices.add("Redis");
  if (/postgres(?:ql)?:\/\//i.test(content) || /\bpg\b|\bpg-promise\b/i.test(content)) metadata.requiredServices.add("PostgreSQL");
  if (/mysql:\/\//i.test(content) || /\bmysql2?\b/i.test(content)) metadata.requiredServices.add("MySQL");
  if (/amqp:\/\//i.test(content) || /\bamqplib\b|\brabbitmq\b/i.test(content)) metadata.requiredServices.add("RabbitMQ");
  if (/kafka:\/\//i.test(content) || /\bkafka-node\b|\bkafkajs\b/i.test(content)) metadata.requiredServices.add("Kafka");
  if (/elastic(?:search)?/i.test(content) || /\belasticsearch\b/i.test(content)) metadata.requiredServices.add("Elasticsearch");

        const listenMatch = content.match(/app\.listen\s*\(\s*(?:process\.env\.(?:PORT|APP_PORT)\s*\|\|\s*)?(\d{2,5})/i);
        if (listenMatch) {
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
            for (const svc of Object.values(metadata.services)) {
              if (!svc.port) { svc.port = parseInt(listenMatch[1], 10); break; }
            }
          }
        }
    } catch (e) { }
  }
  
  metadata.requiredServices = Array.from(metadata.requiredServices);

  const serviceCount = Object.keys(metadata.services).length;
  if (serviceCount > 1) {
    metadata.type = "microservices";
  } else if (serviceCount === 1) {
    metadata.type = "monolith";
  }

  console.log('[SCANNER] Final Metadata:', JSON.stringify(metadata, null, 2));
  return metadata;
}