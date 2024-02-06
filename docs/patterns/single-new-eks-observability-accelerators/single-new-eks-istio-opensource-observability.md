# Single Cluster Open Source Observability - Istio Monitoring

## Objective


## Prerequisites

Ensure that you have installed the following tools on your machine.

1. [aws cli](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
2. [kubectl](https://Kubernetes.io/docs/tasks/tools/)
3. [cdk](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_install)
4. [npm](https://docs.npmjs.com/cli/v8/commands/npm-install)

## Deploying

Please follow the _Deploying_ instructions of the [New EKS Cluster Open Source Observability Accelerator](./single-new-eks-opensource-observability.md) pattern, except for step 7, where you need to replace "context" in `~/.cdk.json` with the following:

```typescript
  "context": {
    "fluxRepository": {
      "name": "grafana-dashboards",
      "namespace": "grafana-operator",
      "repository": {
        "repoUrl": "https://github.com/aws-observability/aws-observability-accelerator",
        "name": "grafana-dashboards",
        "targetRevision": "main",
        "path": "./artifacts/grafana-operator-manifests/eks/infrastructure"
      },
      "values": {
        "GRAFANA_CLUSTER_DASH_URL" : "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/cluster.json",
        "GRAFANA_KUBELET_DASH_URL" : "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/kubelet.json",
        "GRAFANA_NSWRKLDS_DASH_URL" : "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/namespace-workloads.json",
        "GRAFANA_NODEEXP_DASH_URL" : "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/nodeexporter-nodes.json",
        "GRAFANA_NODES_DASH_URL" : "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/nodes.json",
        "GRAFANA_WORKLOADS_DASH_URL" : "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/workloads.json",
        "GRAFANA_ISTIO_CP_DASH_URL" : "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/v0.2.0/artifacts/grafana-dashboards/eks/istio/istio-control-plane-dashboard.json",
        "GRAFANA_ISTIO_MESH_DASH_URL" : "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/v0.2.0/artifacts/grafana-dashboards/eks/istio/istio-mesh-dashboard.json",
        "GRAFANA_ISTIO_PERF_DASH_URL" : "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/v0.2.0/artifacts/grafana-dashboards/eks/istio/istio-performance-dashboard.json",
        "GRAFANA_ISTIO_SERVICE_DASH_URL" : "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/v0.2.0/artifacts/grafana-dashboards/eks/istio/istio-service-dashboard.json"
      },
      "kustomizations": [
        {
          "kustomizationPath": "./artifacts/grafana-operator-manifests/eks/infrastructure"
        },
        {
          "kustomizationPath": "./artifacts/grafana-operator-manifests/eks/istio"
        }
      ]
    },
    "Istio.pattern.enabled": true
  }
```

Once completed the rest of the _Deploying_ steps, you can move on with the deployment of the Istio workload.

## Visualization

### 1. Grafana dashboards

Go to the Dashboards panel of your Grafana workspace. You will see a list of Istio dashboards under the `Observability Accelerator Dashboards`

<img width="1208" alt="image" src="https://github.com/aws-observability/terraform-aws-observability-accelerator/assets/34757337/19b589b4-00f6-465d-a562-1da39e8b9b8c">

Open one of the Istio dasbhoards and you will be able to view its visualization

<img width="1850" alt="image" src="https://user-images.githubusercontent.com/47993564/236842708-72225322-4f97-44cc-aac0-40a3356e50c6.jpeg">

### 2. Amazon Managed Service for Prometheus rules and alerts

Open the Amazon Managed Service for Prometheus console and view the details of your workspace. Under the `Rules management` tab, you will find new rules deployed.

<img width="1054" alt="image" src="https://user-images.githubusercontent.com/47993564/236844084-80c754e3-4fe1-45bb-8361-181432675469.jpeg">

!!! note
    To setup your alert receiver, with Amazon SNS, follow [this documentation](https://docs.aws.amazon.com/prometheus/latest/userguide/AMP-alertmanager-receiver.html)

## Deploy an example application to visualize metrics

In this section we will deploy Istio's Bookinfo sample application and extract metrics using the AWS OpenTelemetry collector. When downloading and configuring `istioctl`, there are samples included in the Istio package directory. The deployment files for Bookinfo are found in the `samples` folder. Additional details can be found on Istio's [Getting Started](https://istio.io/latest/docs/setup/getting-started/) documentation

### 1. Deploy the Bookinfo Application

1. Using the AWS CLI, configure kubectl so you can connect to your EKS cluster. Update for your region and EKS cluster name
```sh
aws eks update-kubeconfig --region <enter-your-region> --name <cluster-name>
```
2. Label the default namespace for automatic Istio sidecar injection
```sh
kubectl label namespace default istio-injection=enabled
```
3. Navigate to the Istio folder location. For example, if using Istio v1.18.2 in Downloads folder:
```sh
cd ~/Downloads/istio-1.18.2
```
4. Deploy the Bookinfo sample application
```sh
kubectl apply -f samples/bookinfo/platform/kube/bookinfo.yaml
```
5. Connect the Bookinfo application with the Istio gateway
```sh
kubectl apply -f samples/bookinfo/networking/bookinfo-gateway.yaml
```
6. Validate that there are no issues with the Istio configuration
```sh
istioctl analyze
```
7. Get the DNS name of the load balancer for the Istio gateway
```sh
GATEWAY_URL=$(kubectl get svc istio-ingressgateway -n istio-system -o=jsonpath='{.status.loadBalancer.ingress[0].hostname}')
```

### 2. Generate traffic for the Istio Bookinfo sample application

For the Bookinfo sample application, visit `http://$GATEWAY_URL/productpage` in your web browser. To see trace data, you must send requests to your service. The number of requests depends on Istio’s sampling rate and can be configured using the Telemetry API. With the default sampling rate of 1%, you need to send at least 100 requests before the first trace is visible. To send a 100 requests to the productpage service, use the following command:
```sh
for i in $(seq 1 100); do curl -s -o /dev/null "http://$GATEWAY_URL/productpage"; done
```

### 3. Explore the Istio dashboards

Log back into your Amazon Managed Grafana workspace and navigate to the dashboard side panel. Click on the `Observability Accelerator Dashboards` folder and open the `Istio Service` Dashboard. Use the Service dropdown menu to select the `reviews.default.svc.cluster.local` service. This gives details about metrics for the service, client workloads (workloads that are calling this service), and service workloads (workloads that are providing this service).

Explore the Istio Control Plane, Mesh, and Performance dashboards as well.

## Teardown

You can teardown the whole CDK stack with the following command:

```bash
make pattern single-new-eks-opensource-observability destroy
```
