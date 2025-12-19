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
  // Now we iterate through the services we just found
  for (const service of Object.values(metadata.services)) {
    if (service.dependencies.some(dep => ['mongoose', 'mongodb'].includes(dep))) {
      metadata.requiredServices.add("MongoDB");
    }
    if (service.dependencies.some(dep => ['redis', 'ioredis'].includes(dep))) {
      metadata.requiredServices.add("Redis");
    }
    if (service.dependencies.includes('pg')) {
      metadata.requiredServices.add("PostgreSQL");
    }
  }

  // --- 3. Scan .env Files (for additional clues) ---
  const envFiles = findFiles(repoPath, /\.env(\..*)?$/);
  // (Regex checks for env files remain the same, they just add to the Set)
  for (const file of envFiles) {
    try {
        const content = fs.readFileSync(file, "utf-8");
        if (/^(MONGO|MONGODB|DATABASE)_URI\s*=\s*['"]?mongodb/im.test(content)) metadata.requiredServices.add("MongoDB");
        if (/^(REDIS_URL|REDIS_HOST)/im.test(content)) metadata.requiredServices.add("Redis");
        if (/^(POSTGRES_URL|DATABASE_URL\s*=\s*['"]?postgres)/im.test(content)) metadata.requiredServices.add("PostgreSQL");
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
        if (/mongoose|mongodb(\+srv)?:\/\//i.test(content)) metadata.requiredServices.add("MongoDB");
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