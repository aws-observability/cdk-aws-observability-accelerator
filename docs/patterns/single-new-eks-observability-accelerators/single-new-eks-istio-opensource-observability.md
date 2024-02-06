# Single Cluster Open Source Observability - Istio Monitoring

## Objective

Service Meshes are an integral part of the Kubernetes environment that enables secure, reliable, and observable communication. Istio is an open-source service mesh that provides advanced network features without requiring any changes to the application code. These capabilities include service-to-service authentication, monitoring, and more.

Istio generates detailed telemetry for all service communications within a mesh. This telemetry provides observability of service behavior, thereby empowering operators to troubleshoot, maintain, and optimize their applications. These features don’t impose additional burdens on service developers. To monitor service behavior, Istio generates metrics for all service traffic in, out, and within an Istio service mesh. These metrics provide information on behaviors, like traffic volume, traffic error rates, and request-response latency.

In addition to monitoring the behavior of services within a mesh, it’s essential to monitor the behavior of the mesh itself. Istio components export metrics which provides insights into the health and function of the mesh control plane.

This pattern configures an Amazon Elastic Kubernetes Service (Amazon EKS) cluster with Istio as a service mesh,  Amazon Managed service for Prometheus, and Amazon Managed Grafana for monitoring your Istio Control and Data plane metrics


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

![image](https://github.com/preddy727/cdk-aws-observability-accelerator/assets/47993564/75c98c21-58f0-4876-8e6f-d88e625ea400)


Open one of the Istio dasbhoards and you will be able to view its visualization

![image](https://github.com/preddy727/cdk-aws-observability-accelerator/assets/47993564/4cd23a12-70ec-43a6-8410-3c1191530a82)


### 2. Amazon Managed Service for Prometheus rules and alerts

Open the Amazon Managed Service for Prometheus console and view the details of your workspace. Under the `Rules management` tab, you will find new rules deployed.

![image](https://github.com/preddy727/cdk-aws-observability-accelerator/assets/47993564/33c89dcb-853a-479c-a210-3870144161e5)


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

![04CBB260-EE0E-405E-BD23-EBCF8333A29D](https://github.com/preddy727/cdk-aws-observability-accelerator/assets/47993564/60b9e537-4e69-476e-861d-7969bf1b91ef)


Explore the Istio Control Plane, Mesh, and Performance dashboards as well.

Control Plane 
![68AC86D7-4959-4527-A723-A19E8FD9E8F5_1_105_c](https://github.com/preddy727/cdk-aws-observability-accelerator/assets/47993564/7c0fa04d-beed-45f4-a5dc-97418323b4a9)

![AD2E46A3-4BC0-4F5A-BEA0-27D2136E6C06](https://github.com/preddy727/cdk-aws-observability-accelerator/assets/47993564/3c913641-8101-459d-87c1-d418433c1960)

Mesh 
![9B04E4D9-6A47-4E4F-AF42-E3A2426B344C](https://github.com/preddy727/cdk-aws-observability-accelerator/assets/47993564/366e33f5-5a54-4bef-afa6-c218aa31bdab)

## Teardown

You can teardown the whole CDK stack with the following command:

```bash
make pattern single-new-eks-opensource-observability destroy
```
