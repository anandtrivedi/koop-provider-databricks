[← Back to README](../README.md) | [Deployment Guide](../DATABRICKS_DEPLOYMENT.md)

# Kubernetes Deployment Guide

Deploy Koop Databricks Provider to any Kubernetes cluster (EKS, GKE, AKS, on-premises, etc.).

## Prerequisites

- Kubernetes cluster (1.19+)
- `kubectl` configured to access your cluster
- Docker registry access (Docker Hub, ECR, GCR, ACR, etc.)
- Databricks workspace with SQL Warehouse
- Either PAT token or Service Principal credentials

## Quick Start

### 1. Build and Push Docker Image

```bash
# Build the image
docker build -t your-registry/koop-databricks:latest .

# Push to your registry
docker push your-registry/koop-databricks:latest
```

**Registry examples:**
- Docker Hub: `your-username/koop-databricks:latest`
- AWS ECR: `123456789012.dkr.ecr.us-east-1.amazonaws.com/koop-databricks:latest`
- GCP GCR: `gcr.io/your-project/koop-databricks:latest`
- Azure ACR: `yourregistry.azurecr.io/koop-databricks:latest`

### 2. Create Databricks Credentials Secret

**Option A: Using Service Principal (recommended for production)**

```bash
kubectl create secret generic databricks-credentials \
  --from-literal=server-hostname=dbc-1e152a66-a886.cloud.databricks.com \
  --from-literal=http-path=/sql/1.0/warehouses/your-warehouse-id \
  --from-literal=client-id=your-service-principal-app-id \
  --from-literal=client-secret=your-service-principal-secret
```

**Option B: Using PAT Token**

```bash
kubectl create secret generic databricks-credentials \
  --from-literal=server-hostname=dbc-1e152a66-a886.cloud.databricks.com \
  --from-literal=http-path=/sql/1.0/warehouses/your-warehouse-id \
  --from-literal=token=dapi1234567890abcdef
```

### 3. Update Deployment Image

Edit `deployment.yaml` and replace the image reference:

```yaml
image: your-registry/koop-databricks:latest  # Update this line
```

### 4. Deploy to Kubernetes

```bash
# Deploy all resources
kubectl apply -f k8s/

# Or deploy individually
kubectl apply -f k8s/secret.yaml       # If using file instead of kubectl create
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml      # Optional
```

### 5. Verify Deployment

```bash
# Check pod status
kubectl get pods -l app=koop-databricks

# Check logs
kubectl logs -l app=koop-databricks -f

# Check service
kubectl get svc koop-databricks

# Get service URL (for LoadBalancer)
kubectl get svc koop-databricks -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

### 6. Test the Provider

```bash
# If using LoadBalancer
export KOOP_URL=$(kubectl get svc koop-databricks -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
curl http://${KOOP_URL}/databricks/rest/info

# If using port-forward (for testing)
kubectl port-forward svc/koop-databricks 8080:80
curl http://localhost:8080/databricks/rest/info
```

## Deployment Options

### Service Types

**LoadBalancer (default)** - Provisions cloud load balancer (AWS ELB, GCP LB, Azure LB)
```yaml
spec:
  type: LoadBalancer
```

**ClusterIP** - Internal cluster access only
```yaml
spec:
  type: ClusterIP
```

**NodePort** - Access via node IP and static port
```yaml
spec:
  type: NodePort
```

### Ingress Configuration

The `ingress.yaml` provides HTTPS access with TLS termination.

**For AWS ALB Ingress Controller:**
```yaml
annotations:
  alb.ingress.kubernetes.io/scheme: internet-facing
  alb.ingress.kubernetes.io/target-type: ip
  alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:region:account:certificate/xxx
```

**For nginx-ingress with cert-manager:**
```yaml
annotations:
  kubernetes.io/ingress.class: "nginx"
  cert-manager.io/cluster-issuer: "letsencrypt-prod"
```

**For GKE Ingress:**
```yaml
annotations:
  kubernetes.io/ingress.class: "gce"
  networking.gke.io/managed-certificates: koop-databricks-cert
```

## Scaling

### Horizontal Scaling

```bash
# Scale to 5 replicas
kubectl scale deployment koop-databricks --replicas=5

# Or edit deployment.yaml
spec:
  replicas: 5
```

### Horizontal Pod Autoscaler (HPA)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: koop-databricks
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: koop-databricks
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Resource Configuration

Adjust based on your workload:

**Light workload:**
```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "250m"
```

**Heavy workload:**
```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

## Health Checks

The deployment includes liveness and readiness probes:

**Liveness Probe** - Restarts unhealthy pods
- Endpoint: `/databricks/rest/info`
- Initial delay: 40 seconds
- Period: 30 seconds
- Failure threshold: 3

**Readiness Probe** - Removes unhealthy pods from service
- Endpoint: `/databricks/rest/info`
- Initial delay: 10 seconds
- Period: 10 seconds
- Failure threshold: 3

## Environment Variables

Additional configuration options (add to deployment.yaml):

```yaml
env:
- name: GEOMETRY_COLUMN
  value: "geometry_wkt"  # Or your custom column name
- name: LOG_LEVEL
  value: "INFO"  # DEBUG, INFO, WARN, ERROR
- name: AUTH_MODE
  value: "disabled"  # or "enabled" for client authentication
```

## Monitoring and Logs

### View Logs

```bash
# All pods
kubectl logs -l app=koop-databricks -f

# Specific pod
kubectl logs koop-databricks-xxxxx-yyyyy -f

# Previous pod instance (after crash)
kubectl logs koop-databricks-xxxxx-yyyyy --previous
```

### Debugging

```bash
# Describe pod (shows events)
kubectl describe pod koop-databricks-xxxxx-yyyyy

# Get pod details
kubectl get pod koop-databricks-xxxxx-yyyyy -o yaml

# Execute command in pod
kubectl exec -it koop-databricks-xxxxx-yyyyy -- sh

# Check environment variables
kubectl exec koop-databricks-xxxxx-yyyyy -- env
```

## Security Best Practices

1. **Use Service Principal instead of PAT tokens** for production
2. **Enable Network Policies** to restrict pod communication
3. **Use Private Container Registry** with image pull secrets
4. **Enable Pod Security Standards** (restricted mode)
5. **Rotate credentials regularly** via secret updates
6. **Use RBAC** to limit access to secrets and deployments
7. **Enable TLS** on Ingress for HTTPS

### Example Network Policy

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: koop-databricks
spec:
  podSelector:
    matchLabels:
      app: koop-databricks
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector: {}  # Allow from all pods in namespace
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - namespaceSelector: {}  # Allow to all namespaces
    ports:
    - protocol: TCP
      port: 443  # HTTPS to Databricks
```

## Platform-Specific Notes

### AWS EKS

```bash
# Create cluster (if needed)
eksctl create cluster --name koop-cluster --region us-east-1 --nodes 2

# Use ECR for images
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

# Deploy
kubectl apply -f k8s/
```

### Google GKE

```bash
# Create cluster (if needed)
gcloud container clusters create koop-cluster --num-nodes=2 --zone=us-central1-a

# Use GCR for images
gcloud auth configure-docker

# Deploy
kubectl apply -f k8s/
```

### Azure AKS

```bash
# Create cluster (if needed)
az aks create --resource-group myResourceGroup --name koop-cluster --node-count 2

# Use ACR for images
az acr login --name yourregistry

# Deploy
kubectl apply -f k8s/
```

### On-Premises / Self-Hosted

- Use NodePort or Ingress (no LoadBalancer)
- Configure external load balancer manually
- Ensure network connectivity to Databricks (firewall rules)

## Updating Deployment

### Rolling Update

```bash
# Update image
kubectl set image deployment/koop-databricks koop-databricks=your-registry/koop-databricks:v2.0.0

# Watch rollout
kubectl rollout status deployment/koop-databricks

# Rollback if needed
kubectl rollout undo deployment/koop-databricks
```

### Update Secret

```bash
# Delete old secret
kubectl delete secret databricks-credentials

# Create new secret
kubectl create secret generic databricks-credentials \
  --from-literal=server-hostname=... \
  --from-literal=client-id=... \
  --from-literal=client-secret=...

# Restart pods to pick up new secret
kubectl rollout restart deployment/koop-databricks
```

## Cleanup

```bash
# Delete all resources
kubectl delete -f k8s/

# Or delete individually
kubectl delete deployment koop-databricks
kubectl delete service koop-databricks
kubectl delete ingress koop-databricks
kubectl delete secret databricks-credentials
```

## Troubleshooting

### Pods not starting

```bash
# Check events
kubectl describe pod koop-databricks-xxxxx-yyyyy

# Common issues:
# - Image pull errors → Check registry credentials
# - Secret not found → Ensure secret is created
# - Health check failures → Check logs for startup errors
```

### Connection issues

```bash
# Test from within cluster
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- curl http://koop-databricks/databricks/rest/info

# Check service endpoints
kubectl get endpoints koop-databricks
```

### Databricks connection errors

```bash
# Check environment variables
kubectl exec koop-databricks-xxxxx-yyyyy -- env | grep DATABRICKS

# Check secret
kubectl get secret databricks-credentials -o yaml

# Test connection manually
kubectl exec -it koop-databricks-xxxxx-yyyyy -- node test-oauth-auth.js
```

## Production Checklist

- [ ] Docker image pushed to secure registry
- [ ] Service Principal created with minimal permissions
- [ ] Secrets created (not committed to git)
- [ ] Resource limits configured appropriately
- [ ] Health checks tested and working
- [ ] Ingress configured with TLS
- [ ] HPA configured for auto-scaling
- [ ] Monitoring and logging set up
- [ ] Network policies applied
- [ ] Backup/DR plan documented
- [ ] Load testing completed

## See Also

**Other Deployment Options:**
- **[Main Deployment Guide](../DATABRICKS_DEPLOYMENT.md)** - Comprehensive guide including:
  - Table preparation
  - Docker and Docker Compose deployment
  - AWS EC2 deployment (real-world lessons)
  - Cloud platform deployment (Azure, GCP)
  - ArcGIS testing and integration

**Related Documentation:**
- **[README.md](../README.md)** - Main project documentation with quick start guide
- **[Configuration Guide](../config/README.md)** - All configuration options explained

## Support

For issues or questions:
- GitHub: https://github.com/anandtrivedi/koop-provider-databricks
- Koop docs: https://koopjs.github.io/
