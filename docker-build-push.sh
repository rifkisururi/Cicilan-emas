#!/bin/bash

# Docker Build & Push Script untuk Cicilan Emas
# Usage: ./docker-build-push.sh <dockerhub-username>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if username is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Docker Hub username is required${NC}"
    echo "Usage: ./docker-build-push.sh <dockerhub-username>"
    exit 1
fi

DOCKERHUB_USERNAME=$1
IMAGE_NAME="cicilan-emas"
VERSION="latest"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Docker Build & Push Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Step 1: Build Docker image
echo -e "${YELLOW}[1/5] Building Docker image...${NC}"
docker build -t ${IMAGE_NAME}:${VERSION} .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi
echo ""

# Step 2: Tag image with Docker Hub username
echo -e "${YELLOW}[2/5] Tagging image...${NC}"
docker tag ${IMAGE_NAME}:${VERSION} ${DOCKERHUB_USERNAME}/${IMAGE_NAME}:${VERSION}
echo -e "${GREEN}✓ Tagged as ${DOCKERHUB_USERNAME}/${IMAGE_NAME}:${VERSION}${NC}"
echo ""

# Step 3: Login to Docker Hub
echo -e "${YELLOW}[3/5] Logging in to Docker Hub...${NC}"
docker login

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Login successful${NC}"
else
    echo -e "${RED}✗ Login failed${NC}"
    exit 1
fi
echo ""

# Step 4: Push to Docker Hub
echo -e "${YELLOW}[4/5] Pushing image to Docker Hub...${NC}"
docker push ${DOCKERHUB_USERNAME}/${IMAGE_NAME}:${VERSION}

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Push successful${NC}"
else
    echo -e "${RED}✗ Push failed${NC}"
    exit 1
fi
echo ""

# Step 5: Verify
echo -e "${YELLOW}[5/5] Verifying...${NC}"
echo -e "${GREEN}✓ Image successfully pushed to Docker Hub${NC}"
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Docker Image Details:${NC}"
echo -e "${GREEN}========================================${NC}"
echo "Repository: ${DOCKERHUB_USERNAME}/${IMAGE_NAME}"
echo "Tag: ${VERSION}"
echo "Pull command: docker pull ${DOCKERHUB_USERNAME}/${IMAGE_NAME}:${VERSION}"
echo ""
echo -e "${GREEN}View on Docker Hub:${NC}"
echo "https://hub.docker.com/r/${DOCKERHUB_USERNAME}/${IMAGE_NAME}"
echo ""
