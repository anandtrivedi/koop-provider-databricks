# AWS EC2 Deployment - Lessons Learned

This document outlines all the steps, mistakes, and solutions from deploying the Koop Databricks Provider to AWS EC2.

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Common Mistakes and Solutions](#common-mistakes-and-solutions)
4. [Step-by-Step Deployment](#step-by-step-deployment)
5. [Troubleshooting](#troubleshooting)

---

## Overview

**Goal**: Deploy Koop Databricks Provider as a Docker container on AWS EC2 to serve Databricks geospatial data to ArcGIS Online over HTTP.

**Final Working Solution**:
- Amazon Linux 2, t3.small instance
- Docker deployment (NOT docker-compose due to buildx compatibility)
- Security group with ports 22 (SSH) and 8080 (Koop) open
- User data script for automated deployment

---

## Prerequisites

### Required Access
- AWS account with EC2, VPC, and security group permissions
- Databricks workspace with SQL Warehouse or general-purpose cluster
- Databricks personal access token
- AWS CLI installed locally

### AWS CLI Setup
```bash
# Install AWS CLI (macOS)
brew install awscli

# Configure with SSO credentials
# If you have temporary credentials, add them to ~/.aws/credentials
```

### Example ~/.aws/credentials format for SSO:
```ini
[332745928618_databricks-sandbox-admin]
aws_access_key_id=YOUR_ACCESS_KEY
aws_secret_access_key=YOUR_SECRET_KEY
aws_session_token=YOUR_SESSION_TOKEN
```

### Example ~/.aws/config:
```ini
[default]
region = us-west-2
output = json

[profile 332745928618_databricks-sandbox-admin]
region = us-west-2
output = json
```

---

## Common Mistakes and Solutions

### ❌ Mistake 1: Using docker-compose

**Problem**: Initial deployment scripts used `docker-compose up -d` which failed with:
```
compose build requires buildx 0.17 or later
```

**Why it happens**: Amazon Linux 2's Docker version doesn't include the required buildx version for newer docker-compose features.

**Solution**: Use direct Docker commands instead:
```bash
# ❌ Don't use this
docker-compose up -d

# ✅ Use this instead
docker build -t koop-databricks-provider:latest .
docker run -d \
  --name koop-databricks-server \
  -p 8080:8080 \
  --env-file .env \
  --restart unless-stopped \
  koop-databricks-provider:latest
```

---

### ❌ Mistake 2: Security Group Rules Not Applied

**Problem**: Created security group but rules list showed `[]` when queried, blocking all traffic.

**Why it happens**: The `aws ec2 create-security-group` command creates the group but doesn't add ingress rules automatically.

**How to identify**:
```bash
aws ec2 describe-security-groups --group-ids sg-XXXXXX \
  --region us-west-2 \
  --query 'SecurityGroups[0].IpPermissions' \
  --output json

# If this returns [], you need to add rules
```

**Solution**: Always add ingress rules AFTER creating the security group:
```bash
# Create security group
SG_ID=$(aws ec2 create-security-group \
  --group-name koop-databricks-sg \
  --description "Security group for Koop Databricks Provider" \
  --region us-west-2 \
  --output text \
  --query 'GroupId')

# Add ingress rules (CRITICAL STEP - don't forget!)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --region us-west-2 \
  --ip-permissions \
    IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges='[{CidrIp=0.0.0.0/0,Description="SSH access"}]' \
    IpProtocol=tcp,FromPort=8080,ToPort=8080,IpRanges='[{CidrIp=0.0.0.0/0,Description="Koop server"}]'
```

**Verification**:
```bash
# Verify rules were added
aws ec2 describe-security-groups --group-ids $SG_ID \
  --region us-west-2 \
  --query 'SecurityGroups[0].IpPermissions' \
  --output json

# Should show rules for ports 22 and 8080
```

---

### ❌ Mistake 3: SSH Blocked from Corporate Network

**Problem**: SSH connections timeout when trying to connect from Databricks corporate network:
```
ssh: connect to host X.X.X.X port 22: Operation timed out
```

**Why it happens**: Corporate firewalls often block outbound SSH (port 22) connections.

**Solutions**:
1. **Use user data scripts** for fully automated deployment (recommended)
2. **Use AWS Systems Manager Session Manager** (requires IAM role setup)
3. **Connect from a different network** (home network, mobile hotspot)

**Recommended approach**: Automate everything in user data script so you never need to SSH:
```bash
#!/bin/bash
# Everything runs automatically on instance launch
# No SSH needed!
```

---

### ❌ Mistake 4: SSM Agent Not Available

**Problem**: Tried to use AWS Systems Manager Session Manager but got:
```
InvalidInstanceId: Instances not in a valid state for account
```

**Why it happens**: Amazon Linux 2 instances need:
1. SSM Agent installed (usually pre-installed)
2. IAM role with `AmazonSSMManagedInstanceCore` policy
3. Outbound HTTPS access to SSM endpoints

**Solution for future deployments**:

Add IAM instance profile during `run-instances`:
```bash
# Create IAM role first
aws iam create-role \
  --role-name EC2-SSM-Role \
  --assume-role-policy-document file://trust-policy.json

# Attach SSM policy
aws iam attach-role-policy \
  --role-name EC2-SSM-Role \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore

# Create instance profile
aws iam create-instance-profile --instance-profile-name EC2-SSM-Profile
aws iam add-role-to-instance-profile \
  --instance-profile-name EC2-SSM-Profile \
  --role-name EC2-SSM-Role

# Then use it when launching instance
aws ec2 run-instances \
  --iam-instance-profile Name=EC2-SSM-Profile \
  # ... other parameters
```

**For our use case**: We used user data automation instead of SSM.

---

### ❌ Mistake 5: Docker Container Not Accessible

**Problem**: Docker container starts but port 8080 doesn't respond even after waiting.

**Possible causes**:
1. **Security group rules not applied** (see Mistake #2)
2. **Container crashed** - Application inside failed to start
3. **Port binding issue** - App listening on 127.0.0.1 instead of 0.0.0.0
4. **Environment variables not loaded** - .env file permissions or path issues

**Debugging steps**:

```bash
# 1. Verify security group rules
aws ec2 describe-security-groups --group-ids sg-XXXXX \
  --query 'SecurityGroups[0].IpPermissions'

# 2. Check system log for container output
aws ec2 get-console-output --instance-id i-XXXXX \
  --query 'Output' --output text | tail -100

# 3. If SSH works, check container status
ssh ec2-user@IP_ADDRESS
docker ps -a  # Check if container is running or exited
docker logs koop-databricks-server  # Check application logs
```

**Solutions**:
- Ensure security group rules include port 8080
- Check Databricks credentials are correct
- Verify .env file is properly formatted
- Ensure Docker CMD starts server on 0.0.0.0:8080 not 127.0.0.1:8080

---

## Step-by-Step Deployment

### Step 1: Setup AWS CLI

```bash
# Install AWS CLI
brew install awscli

# Add credentials to ~/.aws/credentials
# (Get these from AWS Console or SSO)

# Test access
aws sts get-caller-identity --profile YOUR_PROFILE_NAME --region us-west-2
```

### Step 2: Create SSH Key Pair

```bash
# Create key pair
aws ec2 create-key-pair \
  --key-name koop-databricks-key \
  --profile YOUR_PROFILE_NAME \
  --region us-west-2 \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/koop-databricks-key.pem

# Set permissions
chmod 400 ~/.ssh/koop-databricks-key.pem
```

### Step 3: Create Security Group

```bash
# Create security group
SG_ID=$(aws ec2 create-security-group \
  --group-name koop-databricks-sg \
  --description "Security group for Koop Databricks Provider" \
  --profile YOUR_PROFILE_NAME \
  --region us-west-2 \
  --output text \
  --query 'GroupId')

echo "Security Group ID: $SG_ID"

# ⚠️ CRITICAL: Add ingress rules (don't skip this!)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --profile YOUR_PROFILE_NAME \
  --region us-west-2 \
  --ip-permissions \
    IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges='[{CidrIp=0.0.0.0/0,Description="SSH access"}]' \
    IpProtocol=tcp,FromPort=8080,ToPort=8080,IpRanges='[{CidrIp=0.0.0.0/0,Description="Koop server"}]'

# Verify rules were added
aws ec2 describe-security-groups --group-ids $SG_ID \
  --profile YOUR_PROFILE_NAME \
  --region us-west-2 \
  --query 'SecurityGroups[0].IpPermissions' \
  --output json
```

### Step 4: Create User Data Script

Create a file named `user-data.sh`:

```bash
#!/bin/bash
set -x
exec > >(tee /var/log/user-data.log)
exec 2>&1

echo "=== Starting Koop deployment at $(date) ==="

# Update system
yum update -y

# Install Docker and Git
yum install -y docker git
systemctl start docker
systemctl enable docker
usermod -aG docker ec2-user

# Clone repository
cd /home/ec2-user
git clone https://github.com/anandtrivedi/koop-provider-databricks.git
cd koop-provider-databricks

# Create .env file with your Databricks credentials
cat > .env << 'ENV_EOF'
DATABRICKS_TOKEN=YOUR_DATABRICKS_TOKEN_HERE
DATABRICKS_SERVER_HOSTNAME=YOUR_WORKSPACE.cloud.databricks.com
DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/YOUR_WAREHOUSE_ID
# Or for general-purpose cluster:
# DATABRICKS_HTTP_PATH=sql/protocolv1/o/YOUR_ORG_ID/YOUR_CLUSTER_ID
LOG_LEVEL=INFO
PORT=8080
ENV_EOF

# Build Docker image (NOT docker-compose!)
docker build -t koop-databricks-provider:latest .

# Run container
docker run -d \
  --name koop-databricks-server \
  -p 8080:8080 \
  --env-file .env \
  --restart unless-stopped \
  koop-databricks-provider:latest

echo "=== Koop deployment completed at $(date) ==="
echo "Server should be available at http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):8080"
```

**⚠️ IMPORTANT**: Replace these values in user-data.sh:
- `YOUR_DATABRICKS_TOKEN_HERE` - Your Databricks personal access token
- `YOUR_WORKSPACE.cloud.databricks.com` - Your Databricks workspace hostname
- `YOUR_WAREHOUSE_ID` or `YOUR_ORG_ID/YOUR_CLUSTER_ID` - Your compute resource path

### Step 5: Launch EC2 Instance

```bash
# Get the latest Amazon Linux 2 AMI ID
AMI_ID=$(aws ec2 describe-images \
  --profile YOUR_PROFILE_NAME \
  --region us-west-2 \
  --owners amazon \
  --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" "Name=state,Values=available" \
  --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
  --output text)

echo "Using AMI: $AMI_ID"

# Launch instance
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id $AMI_ID \
  --instance-type t3.small \
  --key-name koop-databricks-key \
  --security-group-ids $SG_ID \
  --user-data file://user-data.sh \
  --profile YOUR_PROFILE_NAME \
  --region us-west-2 \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=Koop-Databricks-Server}]' \
  --output text \
  --query 'Instances[0].InstanceId')

echo "Instance ID: $INSTANCE_ID"
echo "Waiting for instance to start..."

# Wait for instance to be running
aws ec2 wait instance-running \
  --instance-ids $INSTANCE_ID \
  --profile YOUR_PROFILE_NAME \
  --region us-west-2

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --profile YOUR_PROFILE_NAME \
  --region us-west-2 \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

echo "Public IP: $PUBLIC_IP"
echo "Koop should be available at: http://$PUBLIC_IP:8080"
echo ""
echo "Note: Deployment takes 2-3 minutes. Check logs with:"
echo "aws ec2 get-console-output --instance-id $INSTANCE_ID --profile YOUR_PROFILE_NAME --region us-west-2 --query 'Output' --output text"
```

### Step 6: Verify Deployment

Wait 2-3 minutes for deployment to complete, then test:

```bash
# Check deployment log
aws ec2 get-console-output \
  --instance-id $INSTANCE_ID \
  --profile YOUR_PROFILE_NAME \
  --region us-west-2 \
  --query 'Output' \
  --output text | tail -50

# Look for these success indicators:
# - "Docker container ID: 65841544b36c..."
# - "=== Koop deployment completed at ..."
# - "Server should be available at http://X.X.X.X:8080"

# Test the endpoints
curl "http://$PUBLIC_IP:8080/databricks/rest/info"

# Should return:
# {"currentVersion":10.51,"fullVersion":"10.5.1"}

# Test with actual data
curl "http://$PUBLIC_IP:8080/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0/query?where=1=1&resultRecordCount=2&f=json"
```

---

## Troubleshooting

### Container starts but port 8080 doesn't respond

**Check security group rules**:
```bash
aws ec2 describe-security-groups --group-ids $SG_ID \
  --profile YOUR_PROFILE_NAME \
  --region us-west-2 \
  --query 'SecurityGroups[0].IpPermissions'
```

Should show rules for TCP ports 22 and 8080.

**If rules are missing, add them**:
```bash
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --profile YOUR_PROFILE_NAME \
  --region us-west-2 \
  --ip-permissions \
    IpProtocol=tcp,FromPort=8080,ToPort=8080,IpRanges='[{CidrIp=0.0.0.0/0,Description="Koop server"}]'
```

**Check container logs** (if SSH is accessible):
```bash
ssh -i ~/.ssh/koop-databricks-key.pem ec2-user@$PUBLIC_IP
docker logs koop-databricks-server
docker ps -a  # Check if container is running
```

### Deployment script failures

**View full user data log**:
```bash
aws ec2 get-console-output \
  --instance-id $INSTANCE_ID \
  --profile YOUR_PROFILE_NAME \
  --region us-west-2 \
  --query 'Output' \
  --output text | less
```

Look for errors in:
- Docker build process
- npm install
- Container startup

### Databricks connection errors

If container starts but can't connect to Databricks:

1. **Verify credentials in user-data.sh**
   - Token is valid and not expired
   - Hostname is correct
   - HTTP path matches your warehouse/cluster

2. **Test Databricks connection directly**:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://YOUR_WORKSPACE.cloud.databricks.com/api/2.0/sql/warehouses"
```

### Instance won't start

**Check instance status**:
```bash
aws ec2 describe-instance-status \
  --instance-ids $INSTANCE_ID \
  --profile YOUR_PROFILE_NAME \
  --region us-west-2 \
  --output json
```

**Common issues**:
- Instance limit reached (increase EC2 limits)
- AMI not available in region
- Insufficient permissions

---

## Summary of What We Changed from Default Docker Deployment

### Original Dockerfile (works):
```dockerfile
FROM --platform=linux/amd64 node:18-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080
CMD [ "npm", "start" ]
```

### What we modified for EC2:

1. **Removed docker-compose.yml dependency**
   - Was causing buildx version errors
   - Used direct `docker build` and `docker run` commands

2. **Used user data for automation**
   - No manual SSH required
   - Fully automated deployment

3. **Security group rules as separate step**
   - Create group first
   - Add rules second (don't forget!)

4. **Environment variables via .env file**
   - Created in user data script
   - Loaded with `--env-file .env`

---

## Files Modified

No changes to the Koop provider code were needed. Changes were only to deployment approach:

- Created new user-data script (not in repo)
- Abandoned docker-compose approach
- Added explicit security group rule setup

---

## Production Recommendations

For production deployments, consider:

1. **Use secrets management**:
   - AWS Secrets Manager for Databricks token
   - Don't hardcode credentials in user data

2. **Setup IAM role for SSM**:
   - Enables Session Manager for secure access
   - No need to open port 22

3. **Use Auto Scaling**:
   - Launch Template with user data
   - Auto Scaling Group for high availability

4. **Add Application Load Balancer**:
   - HTTPS termination
   - Health checks on `/databricks/rest/info`

5. **Enable CloudWatch Logs**:
   - Forward Docker logs to CloudWatch
   - Set up alerts for errors

6. **Setup HTTPS**:
   - Use ACM certificate
   - Configure ALB or nginx reverse proxy

---

## Key Takeaways

✅ **Always add security group ingress rules explicitly**
✅ **Don't rely on docker-compose on Amazon Linux 2 - use direct Docker commands**
✅ **Use user data scripts for fully automated deployment**
✅ **Verify security group rules before testing connectivity**
✅ **Check system logs to see container startup status**
✅ **Plan for SSM access in production (no SSH needed)**

---

## Questions or Issues?

For deployment help:
1. Check system log: `aws ec2 get-console-output --instance-id i-XXXXX`
2. Verify security group rules
3. Test Databricks connection independently
4. Review Docker container logs (if SSH accessible)
