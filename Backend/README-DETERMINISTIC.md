# Deterministic DevOps Generator

This backend now uses deterministic logic and templates to generate DevOps artifacts (Dockerfile, docker-compose, GitHub Actions, Kubernetes manifests, and a security report) without calling any LLMs.

How it works:
- `tools/repoScanner.js` scans the repository for `package.json`, .env clues, and source files to detect services and required services (MongoDB, Redis, etc.).
- `deterministicDevops.js` renders templates from `templates/` using Handlebars and runs `npm audit --json` for each service where possible.
- `POST /generate-devops` (authenticated) will run the generator and write output to `<repoPath>/infra/`.

Quick run (from Backend folder):

```cmd
node scripts/quick-run.js
```

Notes:
- LLM/chat endpoints have been disabled. The frontend will show deterministic outputs only.
- Templates are in `templates/` and can be customized to match your security standards.
