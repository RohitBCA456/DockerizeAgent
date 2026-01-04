DevOps Assistant Agent (DockerizeAgent)
==================================================

**Agent Name:** DeployBot**Version:** 2.0.0**Purpose:** DeployBot is a high-precision DevOps intelligence engine designed to automate the generation of deterministic infrastructure code, perform deep security audits, and provide architectural visualization for complex cloud-native environments.

Core Capabilities & Modules
---------------------------

### 1\. Deterministic Code Generation

DeployBot scans your project repository to produce high-fidelity, standardized configuration files based on the actual logic of your application.

*   **Docker Integration:** Generates optimized multi-stage Dockerfiles and docker-compose.yml configurations designed for minimal image size and maximum security.
    
*   **Kubernetes Manifests:** Produces production-ready deployment.yaml and service.yaml files, including resource limits, labels, and selector mappings.
    
*   **Export to Repo:** Securely commits and pushes generated configurations directly to your repository via authenticated sessions.
    

### 2\. Architecture Visualization & Metadata

*   **System Architecture:** Automatically renders live architectural diagrams (using Mermaid.js syntax) of your services, databases, and traffic flow based on project analysis.
    
*   **Metadata Extraction:** Identifies critical project data including service counts, port assignments, language frameworks, and cross-service dependencies.
    

### 3\. Security, Threat Modeling & Vulnerability Analysis

Every analysis includes a mandatory security posture assessment.

*   **Vulnerability Scanning:** Detailed breakdown of Critical, High, and Low risk issues across all detected services.
    
*   **Threat Modeling:** Automated identification of potential attack vectors, such as unauthorized access points or unencrypted data transit.
    
*   **Granular Reporting:** Specific issue counts per service to prioritize patching efforts.
    

### 4\. Resilience & Disaster Recovery

*   **Disaster Recovery (DR) Planning:** Strategic failover procedures, data restoration playbooks, and Recovery Time Objective (RTO) mapping.
    
*   **Health Monitoring:** Automatic generation of liveness and readiness probes to ensure zero-downtime deployments.
    

Authentication & Access
-----------------------

DeployBot utilizes Google OAuth 2.0 to maintain secure user sessions.

*   **Authenticated Context:** Your security reports and architecture diagrams are private to your account.
    
*   **GitHub/GitLab Integration:** Requires active OAuth permission to execute the "Export to Repo" command and handle automated commits.
    

Detailed System Analysis & Security Report
------------------------------------------

### System Architecture Flow (Mermaid Syntax)

graph TDUser(\[External User\]) -->|HTTPS/443| LB\[Load Balancer\]LB -->|Port 80| AuthSvc\[Auth-Service:8081\]LB -->|Port 80| UserSvc\[User-Service:8080\]AuthSvc -->|Cache| Redis\[(Redis)\]UserSvc -->|Query| DB\[(PostgreSQL:5432)\]UserSvc -.->|Internal| AuthSvc

### Project Metadata

*   Total Services Detected: 3
    
*   Detected Ports: 8080 (User-Service), 8081 (Auth-Service), 5432 (PostgreSQL)
    
*   Frameworks: Node.js (Frontend/Auth), Go (User-Service)
    
*   Deployment Target: Kubernetes (EKS/GKE/AKS)
    

### Vulnerability Report Summary

**Service: User-Service**

*   Port: 8080
    
*   Vulnerabilities: 2 Critical, 1 High, 4 Low
    
*   Status: Critical (Red)
    
*   Findings: Outdated Base Image vulnerable to CVE-2023-XXXX; Container running with root privileges.
    

**Service: Auth-Service**

*   Port: 8081
    
*   Vulnerabilities: 0 Critical, 1 High, 2 Low
    
*   Status: Warning (Yellow)
    

**Service: Database**

*   Port: 5432
    
*   Vulnerabilities: 0 Critical, 0 High, 1 Low
    
*   Status: Secure (Green)
    

Disaster Recovery & Health Monitoring
-------------------------------------

### Health Check Configuration (Plain Text YAML)

Generated Deployment snippet for User-Service
=============================================

spec:containers:

*   name: user-serviceimage: user-service:latestlivenessProbe:httpGet:path: /healthzport: 8080initialDelaySeconds: 15periodSeconds: 20failureThreshold: 3readinessProbe:httpGet:path: /readyport: 8080initialDelaySeconds: 5periodSeconds: 10successThreshold: 1
    

### Disaster Recovery Strategy

*   **Failover:** Multi-region deployment configuration using Global Load Balancers with automated health-based routing.
    
*   **Backup:** Automated volume snapshots for persistent data (PostgreSQL) every 4 hours with cross-region replication.
    
*   **Recovery:** Standardized playbooks for service restoration; target RTO of less than 10 minutes.
    
*   **Data Integrity:** Point-in-time recovery (PITR) enabled for the primary database to prevent data loss from accidental deletion.
