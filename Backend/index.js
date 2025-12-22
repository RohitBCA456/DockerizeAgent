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

import "./config/passport-setup.js"; 
import { connectDB } from "./database/db.js";
import { GOOGLE_OAUTH_ENABLED } from "./config/passport-setup.js";

import { generateFromRepo, generateArchitectureMermaid } from "./deterministicDevops.js";
import { scanRepo } from './tools/repoScanner.js';
import { spawnSync } from 'child_process';

dotenv.config();
const app = express();

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

const DEV_MODE = process.env.DEV_MODE === 'true' || process.env.NODE_ENV !== 'production';
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const allowDevOrAuth = (req, res, next) => {
  if (DEV_MODE) return next();
  return ensureAuthenticated(req, res, next);
};

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

app.post("/generate-devops", ensureAuthenticated, async (req, res) => {
  try {
    const { repoPath } = req.body;
    if (!repoPath || !path.isAbsolute(repoPath))
      return res.status(400).json({ error: "Absolute repoPath required" });

    const output = generateFromRepo(repoPath);

    const outputPath = path.join(repoPath, "infra");
    fs.mkdirSync(outputPath, { recursive: true });

    for (const [svc, content] of Object.entries(output.generatedContent.dockerfiles)) {
      const svcPath = path.join(outputPath, svc);
      fs.mkdirSync(svcPath, { recursive: true });
      fs.writeFileSync(path.join(svcPath, "Dockerfile"), content);
    }

    if (output.generatedContent.dockerCompose) {
      fs.writeFileSync(path.join(outputPath, "docker-compose.yml"), output.generatedContent.dockerCompose);
    }

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

app.post('/quick-health', allowDevOrAuth, async (req, res) => {
  try {
    const { repoPath } = req.body;
    if (!repoPath) return res.status(400).json({ error: 'repoPath required' });
    const meta = scanRepo(repoPath);
    const maintenance = {};
    for (const [svcName, svc] of Object.entries(meta.services || {})) {
      try {
        const pkg = path.join(svc.path, 'package.json');
        if (fs.existsSync(pkg)) {
          const proc = spawnSync(npmCmd, ['outdated', '--json'], { cwd: svc.path, encoding: 'utf-8', shell: true });
          const outdated = proc.stdout ? JSON.parse(proc.stdout) : {};
          maintenance[svcName] = { numOutdated: Object.keys(outdated).length, outdated };
        } else {
          maintenance[svcName] = { numOutdated: 0, outdated: {} };
        }
      } catch (e) {
        maintenance[svcName] = { numOutdated: 0, outdated: {} };
      }
    }

    const portChecks = [];
    for (const [svcName, svc] of Object.entries(meta.services || {})) {
      if (svc.port) portChecks.push({ service: svcName, port: svc.port, inUse: false });
    }

    res.json({ metadata: meta, maintenance, portChecks });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/threat-model', allowDevOrAuth, async (req, res) => {
  try {
    const { repoPath } = req.body;
    if (!repoPath) return res.status(400).json({ error: 'repoPath required' });

    const meta = scanRepo(repoPath);
    const projectName = meta.metadata?.name || Object.keys(meta.services || {}).join(', ') || path.basename(repoPath);

    const deps = [];
    for (const svc of Object.values(meta.services || {})) {
      try {
        const pj = JSON.parse(fs.readFileSync(path.join(svc.path, 'package.json'), 'utf-8'));
        deps.push(...Object.keys(pj.dependencies || {}));
      } catch (e) { }
    }
    const uniqDeps = Array.from(new Set(deps)).slice(0, 10);

    const queries = [];
    queries.push(`${projectName} security risks`);
    queries.push(`${projectName} vulnerabilities`);
    uniqDeps.forEach(d => { queries.push(`${d} vulnerabilities`); queries.push(`${d} security advisory`); });

    const evidence = [];
    const cheerio = await import('cheerio');

    for (const q of queries.slice(0, 8)) {
      try {
        const ddg = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
        const resp = await fetch(ddg, { headers: { 'User-Agent': 'DevOpsAgent/1.0' } });
        const html = await resp.text();
        const $ = cheerio.load(html);
        $('a.result__a').each((i, el) => {
          if (i >= 3) return;
          const title = $(el).text().trim();
          const href = $(el).attr('href');
          const snippet = $(el).closest('.result').find('.result__snippet').text().trim();
          evidence.push({ query: q, title, href, snippet });
        });
      } catch (e) { }
    }

    let critical = 0, high = 0;
    for (const ev of evidence) {
      const txt = `${ev.title}\n${ev.snippet}`.toLowerCase();
      if (txt.includes('critical')) critical += 1;
      if (txt.includes('high')) high += 1;
      if (/cve-\d{4}-\d+/i.test(txt)) high += 1;
    }

    let md = `# Threat Model & Evidence (Web-sourced)\n\n`;
    md += `Generated from live web search results for: **${projectName}**\n\n`;
    if (evidence.length) {
      md += '## Top Evidence & References\n';
      evidence.slice(0, 12).forEach(e => {
        md += `- [${e.title || e.href}](${e.href}) — ${e.snippet}\n`;
      });
      md += '\n---\n\n';
    } else {
      md += '_No external evidence found from web queries._\n\n';
    }

    md += '## Findings (summary)\n';
    md += `- Evidence hits: ${evidence.length}\n`;
    md += `- Heuristic Critical indicators: ${critical}\n`;
    md += `- Heuristic High indicators: ${high}\n\n`;
    md += '## Next steps\n- Review the linked references and validate any CVE/advisory details.\n- Run authoritative CVE lookups (OSV/NVD/GitHub) for confirmed severity and fixes.\n';

    res.json({ markdown: md, evidence, totals: { critical, high } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Threat model generation failed', details: e.message }); }
});

app.post('/disaster-recovery', allowDevOrAuth, async (req, res) => {
  try {
    const { repoPath } = req.body;
    if (!repoPath) return res.status(400).json({ error: 'repoPath required' });
    const meta = scanRepo(repoPath);
    const projectName = meta.metadata?.name || Object.keys(meta.services || {}).join(', ') || path.basename(repoPath);
    const queries = [`${projectName} disaster recovery plan`, `${projectName} backup and restore`];
    const evidence = [];
    const cheerio = await import('cheerio');
    for (const q of queries) {
      try {
        const ddg = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
        const resp = await fetch(ddg, { headers: { 'User-Agent': 'DevOpsAgent/1.0' } });
        const html = await resp.text();
        const $ = cheerio.load(html);
        $('a.result__a').each((i, el) => {
          if (i >= 4) return;
          const title = $(el).text().trim();
          const href = $(el).attr('href');
          const snippet = $(el).closest('.result').find('.result__snippet').text().trim();
          evidence.push({ query: q, title, href, snippet });
        });
      } catch (e) { }
    }
    let md = `# Disaster Recovery Plan (Web-sourced)\n\n`;
    md += `Guidance gathered from web resources for **${projectName}**\n\n`;
    if (evidence.length) {
      md += '## References\n';
      evidence.slice(0, 10).forEach(e => { md += `- [${e.title || e.href}](${e.href}) — ${e.snippet}\n`; });
      md += '\n---\n\n';
    }
    md += '## Suggested Playbook (generalized)\n1. Detect & contain\n2. Notify stakeholders\n3. Restore from last good backup\n4. Validate and promote\n5. Post-mortem and update runbooks\n';
    res.json({ markdown: md, evidence });
  } catch (e) { console.error(e); res.status(500).json({ error: 'DR plan generation failed', details: e.message }); }
});

app.post('/architecture-map', ensureAuthenticated, async (req, res) => {
  try {
    const { repoPath } = req.body;
    const mermaid = generateArchitectureMermaid(repoPath);
    res.json({ mermaid });
  } catch (e) {
    res.status(500).json({ error: "Mapping failed" });
  }
});

  /* ---------------- AVATAR PROXY (small secure proxy for remote avatars) ---------------- */
  app.get('/avatar', async (req, res) => {
    try {
      const u = req.query.u;
      if (!u) return res.status(400).send('missing');
      // only allow a small set of trusted hostnames to avoid open proxy
      const allowed = ['ui-avatars.com', 'lh3.googleusercontent.com', 'googleusercontent.com', 'avatars.githubusercontent.com'];
      let url;
      try { url = new URL(u); } catch (e) { return res.status(400).send('invalid url'); }
      if (!allowed.some(h => url.hostname.includes(h))) return res.status(403).send('forbidden');

      const resp = await fetch(url.toString(), { headers: { 'User-Agent': 'DevOpsAgent/1.0' } });
      if (!resp.ok) return res.status(502).send('bad upstream');
      const contentType = resp.headers.get('content-type') || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      const buffer = Buffer.from(await resp.arrayBuffer());
      res.send(buffer);
    } catch (e) {
      console.error('Avatar proxy error', e && e.message ? e.message : e);
      res.status(500).send('error');
    }
  });

const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
  await connectDB();
  console.log(`DevOps AI Agent Backend running at http://localhost:${PORT}`);
});