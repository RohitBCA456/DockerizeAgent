/**
 * DEVOPS AI AGENT - BACKEND SERVER
 * Features: Deterministic DevOps Generation, Security Auditing, 
 * Git Safety, and Architecture Mapping.
 */

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

import express from "express";
import session from "express-session";
import passport from "passport";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import cors from "cors";

// Configurations & Database
import "./config/passport-setup.js"; 
import { connectDB } from "./database/db.js";
import { GOOGLE_OAUTH_ENABLED } from "./config/passport-setup.js";

// Deterministic Tools
import { runPreflight } from "./preflight.js";
import { generateFromRepo, generateArchitectureMermaid } from "./deterministicDevops.js";
import { computeEntropy } from "./securityTools.js";

dotenv.config();
const app = express();

/* ---------------- MIDDLEWARE ---------------- */
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: "Not authenticated" });
};

/* ---------------- AUTH ROUTES ---------------- */
if (GOOGLE_OAUTH_ENABLED) {
  app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
  app.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/" }),
    (req, res) => res.send("<script>window.close()</script>")
  );
} else {
  app.get('/auth/google', (req, res) => res.status(503).json({ error: 'OAuth not configured' }));
}

app.get("/api/current_user", (req, res) => {
  if (req.user) res.json(req.user);
  else res.status(401).json({ message: "Not logged in" });
});

app.get("/api/logout", (req, res) => {
  req.logout(() => res.json({ message: "Logged out" }));
});

/* ---------------- HEALTH CHECK ---------------- */
app.get("/health", (_, res) => res.json({ status: "ok", engine: "deterministic" }));

/* ---------------- DEVOPS GENERATOR ---------------- */
app.post("/generate-devops", ensureAuthenticated, async (req, res) => {
  try {
    const { repoPath } = req.body;
    if (!repoPath || !path.isAbsolute(repoPath))
      return res.status(400).json({ error: "Absolute repoPath required" });

    const output = generateFromRepo(repoPath);

    // Write output files to the local repo under /infra
    const outputPath = path.join(repoPath, "infra");
    fs.mkdirSync(outputPath, { recursive: true });

    // 1. Dockerfiles
    for (const [svc, content] of Object.entries(output.generatedContent.dockerfiles)) {
      const svcPath = path.join(outputPath, svc);
      fs.mkdirSync(svcPath, { recursive: true });
      fs.writeFileSync(path.join(svcPath, "Dockerfile"), content);
    }

    // 2. Docker Compose
    if (output.generatedContent.dockerCompose) {
      fs.writeFileSync(path.join(outputPath, "docker-compose.yml"), output.generatedContent.dockerCompose);
    }

    // 3. Security Report
    fs.writeFileSync(path.join(outputPath, "security-report.md"), output.generatedContent.securityReport || "");

    res.json({
      message: "DevOps files generated successfully",
      metadata: output.metadata,
      generatedContent: output.generatedContent,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Generation failed" });
  }
});

/* ---------------- WEB SEARCH (DuckDuckGo) ---------------- */
app.post("/search-web", ensureAuthenticated, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "Query required" });

    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const resp = await fetch(ddgUrl, { headers: { 'User-Agent': 'DevOpsAgent/1.0' } });
    const html = await resp.text();
    
    const cheerio = await import('cheerio');
    const $ = cheerio.load(html);
    const results = [];
    
    $('a.result__a').each((i, el) => {
      if (i >= 5) return;
      results.push({
        title: $(el).text().trim(),
        href: $(el).attr('href'),
        snippet: $(el).closest('.result').find('.result__snippet').text().trim()
      });
    });

    res.json({ query, results });
  } catch (err) {
    res.status(500).json({ error: "Search failed" });
  }
});

/* ---------------- PREFLIGHT (Ports & Maintenance) ---------------- */
app.post('/preflight', ensureAuthenticated, async (req, res) => {
  try {
    const { repoPath } = req.body;
    if (!repoPath) return res.status(400).json({ error: 'repoPath required' });
    const result = await runPreflight(repoPath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Preflight failed' });
  }
});

/* ---------------- SECURITY & PATTERN AUDIT ---------------- */
app.post("/security-details", ensureAuthenticated, async (req, res) => {
  try {
    const { repoPath } = req.body;
    if (!repoPath) return res.status(400).json({ error: "repoPath required" });

    const findings = {
      envSecrets: [],
      patternIssues: [],
      corsIssues: []
    };

    function scan(dir) {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) {
          if (!['node_modules', '.git'].includes(f)) scan(p);
        } else {
          const content = fs.readFileSync(p, 'utf-8');
          
          // 1. Secret Entropy & Keyword Check (in .env)
          if (f.includes('.env')) {
            const lines = content.split('\n');
            lines.forEach(line => {
              if (/SECRET|KEY|TOKEN|PASS/i.test(line)) {
                const entropy = computeEntropy(line.split('=')[1] || "");
                findings.envSecrets.push({ file: f, line: line.trim(), entropy: entropy.toFixed(2) });
              }
            });
          }

          // 2. Insecure Code Patterns
          if (/\.(js|ts)$/.test(f)) {
            if (/eval\(/.test(content)) findings.patternIssues.push({ file: f, issue: 'eval_usage' });
            if (/origin\s*:\s*['"]\*['"]/.test(content)) findings.corsIssues.push({ file: f, issue: 'cors_wildcard' });
          }
        }
      }
    }

    scan(repoPath);
    res.json(findings);
  } catch (err) {
    res.status(500).json({ error: "Security scan failed" });
  }
});

/* ---------------- GIT SAFETY SENTINEL ---------------- */
app.post('/check-git-safety', ensureAuthenticated, async (req, res) => {
  try {
    const { repoPath, autoFix } = req.body;
    const gitignorePath = path.join(repoPath, '.gitignore');
    const sensitive = ['.env', 'node_modules', '*.pem', 'infra/'];
    
    let content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf-8') : '';
    const missing = sensitive.filter(p => !content.includes(p));

    if (autoFix && missing.length) {
      fs.appendFileSync(gitignorePath, `\n# Added by DevOps Agent\n${missing.join('\n')}\n`);
      return res.json({ status: 'fixed', fixed: missing });
    }
    res.json({ status: missing.length ? 'vulnerable' : 'safe', missing });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ---------------- ARCHITECTURE MAP (Mermaid) ---------------- */
app.post('/architecture-map', ensureAuthenticated, async (req, res) => {
  try {
    const { repoPath } = req.body;
    const mermaid = generateArchitectureMermaid(repoPath);
    res.json({ mermaid });
  } catch (e) {
    res.status(500).json({ error: "Mapping failed" });
  }
});

/* ---------------- SERVER START ---------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
  await connectDB();
  console.log(`🚀 DevOps AI Agent Backend running at http://localhost:${PORT}`);
});