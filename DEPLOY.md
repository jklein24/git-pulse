# GitPulse Deployment Plan

Deploy to the Lightspark tooling cluster (`tooling.sparkinfra.net`) following the same pattern as [golinks](https://github.com/lightsparkdev/golinks).

Target URL: `gitpulse.tooling.sparkinfra.net`

## Architecture

```
User → ALB (HTTPS, created by Ingress annotations) → Service → Pod (Next.js :3000)
                                                                       ↓
                                                                 RDS PostgreSQL
```

Single-replica stateless Next.js app. All state lives in PostgreSQL. No Redis, no workers, no cron.

## What's Already Built

Everything lives in this repo (no tooling-infra changes needed):

| Component | Location | Status |
|-----------|----------|--------|
| Dockerfile | `Dockerfile` | Done |
| Helm chart | `helm/gitpulse/` | Done |
| CI/CD workflow | `.github/workflows/ci.yml` | Done |
| Health endpoint | `src/app/api/health/route.ts` | Done |
| PG migrations | `drizzle/0000_oval_centennial.sql` | Done |
| Terraform (ECR, IAM, RDS) | `terraform/` | Done |

## Deploy Steps

### 1. Apply Terraform

Provisions ECR repo, GitHub Actions IAM role, and RDS PostgreSQL.

```bash
cd terraform/
terraform init
terraform apply
```

This creates:
- ECR repo `gitpulse` (immutable tags, scan on push)
- IAM role `github-actions-gitpulse` (OIDC trust for this repo's CI)
- RDS `db.t4g.micro` PostgreSQL 16 (encrypted, 7-day backups, deletion protection)
- Secrets Manager secret with the generated DB password

### 2. Create GitHub OAuth App

At https://github.com/settings/developers, create a new OAuth App:
- Homepage URL: `https://gitpulse.tooling.sparkinfra.net`
- Callback URL: `https://gitpulse.tooling.sparkinfra.net/api/auth/callback`
- Scopes: `read:user`, `user:email`

### 3. Create K8s Secret

```bash
# Get DB password and endpoint from terraform
DB_PASS=$(aws secretsmanager get-secret-value \
  --secret-id gitpulse/db-password --query SecretString --output text)
DB_HOST=$(cd terraform && terraform output -raw rds_address)

# Generate encryption key
PAT_KEY=$(openssl rand -hex 32)

kubectl create namespace gitpulse

kubectl -n gitpulse create secret generic gitpulse-secrets \
  --from-literal=DATABASE_URL="postgres://gitpulse:${DB_PASS}@${DB_HOST}:5432/gitpulse" \
  --from-literal=GITHUB_CLIENT_ID="<from step 2>" \
  --from-literal=GITHUB_CLIENT_SECRET="<from step 2>" \
  --from-literal=PAT_ENCRYPTION_KEY="${PAT_KEY}" \
  --from-literal=ANTHROPIC_API_KEY="<optional>"
```

### 4. Run Initial DB Migration

One-time migration to create all tables:

```bash
# Build and run migration locally against the RDS instance, or:
kubectl -n gitpulse run migrate --rm -it --restart=Never \
  --image=<ecr-url>/gitpulse:<tag> \
  --env="DATABASE_URL=postgres://gitpulse:${DB_PASS}@${DB_HOST}:5432/gitpulse" \
  -- node -e "require('./src/lib/db/migrate').runMigrations()"
```

### 5. Register ArgoCD Application

Via the ArgoCD CLI (matching the golinks pattern):

```bash
argocd app create gitpulse \
  --repo https://github.com/lightsparkdev/git-productivity \
  --revision deploy \
  --path helm/gitpulse \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace gitpulse \
  --sync-policy automated \
  --auto-prune \
  --self-heal \
  --parameter image.repository=405785876631.dkr.ecr.us-west-2.amazonaws.com/gitpulse \
  --parameter image.tag=latest \
  --parameter ingress.domain=gitpulse.tooling.sparkinfra.net
```

### 6. First Deploy

Push to main. CI will build the image, push to ECR, and tell ArgoCD to sync.

The Helm chart's Ingress annotations cause the AWS Load Balancer Controller to
automatically create an ALB with an ACM certificate for the domain.

DNS: you may need to create a Route53 CNAME/alias record for
`gitpulse.tooling.sparkinfra.net` pointing to the ALB DNS name (check if
external-dns handles this automatically in the cluster).

## Environment Variables

Injected via the `gitpulse-secrets` K8s secret:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth app secret |
| `PAT_ENCRYPTION_KEY` | Yes | 32-byte hex key for encrypting stored PATs |
| `ANTHROPIC_API_KEY` | No | For AI ask/summary features |
