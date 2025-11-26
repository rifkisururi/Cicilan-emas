# 🐳 Docker Hub Deployment Guide

Panduan lengkap untuk build dan push Docker image ke Docker Hub.

---

## 📋 Prerequisites

1. **Docker Desktop** installed
   - Download: https://www.docker.com/products/docker-desktop

2. **Docker Hub Account**
   - Sign up: https://hub.docker.com/signup
   - Note your username

---

## 🚀 Method 1: Quick Deploy (Recommended)

### Step 1: Make Script Executable

```bash
chmod +x docker-build-push.sh
```

### Step 2: Run Script

```bash
./docker-build-push.sh <your-dockerhub-username>
```

**Example:**
```bash
./docker-build-push.sh rifkisururi
```

Script akan otomatis:
- ✅ Build Docker image
- ✅ Tag dengan username Anda
- ✅ Login ke Docker Hub
- ✅ Push image
- ✅ Verify upload

---

## 🔧 Method 2: Manual Step-by-Step

### Step 1: Build Docker Image

```bash
docker build -t cicilan-emas:latest .
```

**Output:**
```
[+] Building 45.2s (12/12) FINISHED
=> [internal] load build definition from Dockerfile
=> => transferring dockerfile: 450B
=> [internal] load .dockerignore
...
=> exporting to image
=> => naming to docker.io/library/cicilan-emas:latest
```

### Step 2: Tag Image

```bash
# Format: docker tag <image>:<tag> <dockerhub-username>/<image>:<tag>
docker tag cicilan-emas:latest <your-username>/cicilan-emas:latest
```

**Example:**
```bash
docker tag cicilan-emas:latest rifkisururi/cicilan-emas:latest
```

### Step 3: Login to Docker Hub

```bash
docker login
```

Enter your Docker Hub credentials:
```
Username: your-username
Password: your-password (or access token)
```

**Success:**
```
Login Succeeded
```

### Step 4: Push to Docker Hub

```bash
docker push <your-username>/cicilan-emas:latest
```

**Example:**
```bash
docker push rifkisururi/cicilan-emas:latest
```

**Output:**
```
The push refers to repository [docker.io/rifkisururi/cicilan-emas]
5f70bf18a086: Pushed
d37096b5b4e5: Pushed
...
latest: digest: sha256:abc123... size: 2211
```

### Step 5: Verify on Docker Hub

Buka browser:
```
https://hub.docker.com/r/<your-username>/cicilan-emas
```

---

## 🏷️ Push Multiple Tags (Optional)

### Version Tag

```bash
# Tag dengan version number
docker tag cicilan-emas:latest <username>/cicilan-emas:v1.0.0
docker push <username>/cicilan-emas:v1.0.0
```

### Production Tag

```bash
# Tag untuk production
docker tag cicilan-emas:latest <username>/cicilan-emas:production
docker push <username>/cicilan-emas:production
```

### All Tags

```bash
# Push all tags
docker push <username>/cicilan-emas --all-tags
```

---

## 📥 Pull & Run Image

Setelah image di-push, siapapun dapat pull dan run:

```bash
# Pull image
docker pull <username>/cicilan-emas:latest

# Run container
docker run -d \
  -p 3000:3000 \
  -e DB_HOST=your-db-host \
  -e DB_PORT=5432 \
  -e DB_NAME=cicilan_emas_db \
  -e DB_USER=postgres \
  -e DB_PASSWORD=your-password \
  -e SESSION_SECRET=your-secret \
  --name cicilan-emas-app \
  <username>/cicilan-emas:latest
```

---

## 🤖 Method 3: Automated with GitHub Actions

### Create `.github/workflows/docker-publish.yml`

```yaml
name: Docker Build & Push

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ secrets.DOCKERHUB_USERNAME }}/cicilan-emas
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}

      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Setup GitHub Secrets

1. Go to: `Repository → Settings → Secrets → Actions`
2. Add secrets:
   - `DOCKERHUB_USERNAME`: Your Docker Hub username
   - `DOCKERHUB_TOKEN`: Your Docker Hub access token

### Create Access Token

1. Go to: https://hub.docker.com/settings/security
2. Click **"New Access Token"**
3. Name: `github-actions`
4. Permissions: **Read, Write, Delete**
5. Copy token and save to GitHub Secrets

### How It Works

- Push ke `main` branch → Auto build & push dengan tag `main`
- Push tag `v1.0.0` → Auto build & push dengan tag `v1.0.0`

---

## 🔍 Image Information

After successful push:

### Image Details
```
Repository: <username>/cicilan-emas
Tags: latest, v1.0.0, production
Size: ~200MB (compressed)
Architecture: amd64
OS: linux
```

### Image Layers
```
Layer 1: Node.js 18 Alpine
Layer 2: Application dependencies
Layer 3: Application code
Layer 4: Uploads directory
```

---

## 📊 Docker Hub Repository Settings

### Set Repository Visibility

**Public (Recommended for open source):**
- Anyone can pull
- Free unlimited pulls

**Private (For proprietary code):**
- Only you and collaborators can pull
- Limited free private repos

### Repository Description

```
Platform Penyedia Cicilan Emas - Fullstack Node.js Application

Features:
- Express.js backend with PostgreSQL
- Modern EJS templates
- Session-based authentication
- Installment calculation system
- Admin & User dashboards

Stack: Node.js, Express, PostgreSQL, EJS, Docker
```

---

## 🧹 Cleanup Local Images

Remove local images after push:

```bash
# Remove untagged images
docker image prune

# Remove specific image
docker rmi cicilan-emas:latest

# Remove all unused images
docker system prune -a
```

---

## 🐛 Troubleshooting

### Build Failed - Out of Memory
```bash
# Increase Docker memory in Docker Desktop Settings
# Minimum: 2GB RAM
```

### Push Failed - Authentication Required
```bash
# Logout and login again
docker logout
docker login
```

### Image Too Large
```bash
# Use .dockerignore to exclude files
# Check current size
docker images cicilan-emas:latest
```

### Tag Not Found
```bash
# List all local images
docker images

# Retag if needed
docker tag <image-id> <username>/cicilan-emas:latest
```

---

## 📈 Best Practices

1. **Use Specific Tags**
   - ✅ `v1.0.0`, `production`, `staging`
   - ❌ Only using `latest`

2. **Multi-stage Builds** (Already implemented)
   - Smaller image size
   - Faster pulls

3. **Security Scanning**
   ```bash
   docker scan <username>/cicilan-emas:latest
   ```

4. **Regular Updates**
   - Update base image (node:18-alpine)
   - Update dependencies
   - Rebuild monthly

5. **Image Documentation**
   - Add README on Docker Hub
   - Include usage examples
   - Document environment variables

---

## 🔗 Useful Links

- **Docker Hub:** https://hub.docker.com
- **Docker Docs:** https://docs.docker.com
- **Best Practices:** https://docs.docker.com/develop/dev-best-practices/

---

## ✅ Quick Command Reference

```bash
# Build
docker build -t cicilan-emas:latest .

# Tag
docker tag cicilan-emas:latest username/cicilan-emas:latest

# Login
docker login

# Push
docker push username/cicilan-emas:latest

# Pull
docker pull username/cicilan-emas:latest

# Run
docker run -d -p 3000:3000 --env-file .env username/cicilan-emas:latest

# Stop
docker stop <container-id>

# Remove
docker rm <container-id>
docker rmi username/cicilan-emas:latest
```

---

**Happy Dockering! 🐳**
