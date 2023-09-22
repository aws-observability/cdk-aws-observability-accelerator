# Single New EKS Fargate Cluster AWS Native Observability Accelerator

## Architecture

The following figure illustrates the architecture of the pattern we will be deploying for Single EKS Fargate Cluster Native Observability pattern using AWS native tools such as CloudWatch Logs and Container Insights.

![Architecture](../images/cloud-native-arch.png)

This example makes use of CloudWatch Container Insights as a vizualization and metric-aggregation layer.
Amazon CloudWatch Container Insights helps customers collect, aggregate, and summarize metrics and logs from containerized applications and microservices. Metrics data is collected as performance log events using the embedded metric format. These performance log events use a structured JSON schema that enables high-cardinality data to be ingested and stored at scale. From this data, CloudWatch creates aggregated metrics at the cluster, node, pod, task, and service level as CloudWatch metrics. The metrics that Container Insights collects are available in CloudWatch automatic dashboards.

By combining Container Insights and CloudWatch logs, we are able to provide a foundation for EKS (Amazon Elastic Kubernetes Service) Observability. Monitoring EKS for metrics has two categories:
the control plane and the Amazon EKS nodes (with Kubernetes objects).
The Amazon EKS control plane consists of control plane nodes that run the Kubernetes software,
such as etcd and the Kubernetes API server. To read more on the components of an Amazon EKS cluster,
please read the [service documentation](https://docs.aws.amazon.com/eks/latest/userguide/clusters.html).


## Objective

- Deploys one production grade Amazon EKS Fargate cluster.
- Logs with CloudWatch Logs
- Enables CloudWatch Container Insights.
- Installs Prometheus Node Exporter and Metrics Server for infrastructure metrics.

## Prerequisites:

Ensure that you have installed the following tools on your machine.

1. [aws cli](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
2. [kubectl](https://Kubernetes.io/docs/tasks/tools/)
3. [cdk](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_install)
4. [npm](https://docs.npmjs.com/cli/v8/commands/npm-install)


## Deploying

1. Clone your forked repository

```sh
git clone https://github.com/aws-observability/cdk-aws-observability-accelerator.git
```

2. Install the AWS CDK Toolkit globally on your machine using

```bash
npm install -g aws-cdk
```

3. Install project dependencies by running `npm install` in the main folder of this cloned repository

4. Once all pre-requisites are set you are ready to deploy the pipeline. Run the following command from the root of this repository to deploy the pipeline stack:

```bash
make build
make pattern single-new-eks-awsnative-fargate-observability deploy
```


## Verify the resources

Run update-kubeconfig command. You should be able to get the command from CDK output message.

```bash
aws eks update-kubeconfig --name single-new-eks-awsnative-fargate-observability-accelerator --region <your region> --role-arn arn:aws:iam::xxxxxxxxx:role/single-new-eks-awsnative-singleneweksawsnativeobs-xxxxxxxx
```


Let’s verify the resources created by steps above.

```bash
kubectl get nodes -o wide
```
```
Output:
NAME                                   STATUS   ROLES    AGE   VERSION               INTERNAL-IP    EXTERNAL-IP   OS-IMAGE         KERNEL-VERSION                  CONTAINER-RUNTIME
fargate-ip-10-0-102-84.ec2.internal    Ready    <none>   15m   v1.27.1-eks-2f008fe   10.0.102.84    <none>        Amazon Linux 2   5.10.184-175.749.amzn2.x86_64   containerd://1.6.6
fargate-ip-10-0-124-175.ec2.internal   Ready    <none>   12m   v1.27.1-eks-2f008fe   10.0.124.175   <none>        Amazon Linux 2   5.10.184-175.749.amzn2.x86_64   containerd://1.6.6
fargate-ip-10-0-126-244.ec2.internal   Ready    <none>   15m   v1.27.1-eks-2f008fe   10.0.126.244   <none>        Amazon Linux 2   5.10.184-175.749.amzn2.x86_64   containerd://1.6.6
fargate-ip-10-0-132-165.ec2.internal   Ready    <none>   12m   v1.27.1-eks-2f008fe   10.0.132.165   <none>        Amazon Linux 2   5.10.186-179.751.amzn2.x86_64   containerd://1.6.6
fargate-ip-10-0-159-96.ec2.internal    Ready    <none>   15m   v1.27.1-eks-2f008fe   10.0.159.96    <none>        Amazon Linux 2   5.10.186-179.751.amzn2.x86_64   containerd://1.6.6
fargate-ip-10-0-170-28.ec2.internal    Ready    <none>   14m   v1.27.1-eks-2f008fe   10.0.170.28    <none>        Amazon Linux 2   5.10.186-179.751.amzn2.x86_64   containerd://1.6.6
fargate-ip-10-0-173-57.ec2.internal    Ready    <none>   15m   v1.27.1-eks-2f008fe   10.0.173.57    <none>        Amazon Linux 2   5.10.186-179.751.amzn2.x86_64   containerd://1.6.6
fargate-ip-10-0-175-87.ec2.internal    Ready    <none>   15m   v1.27.1-eks-2f008fe   10.0.175.87    <none>        Amazon Linux 2   5.10.186-179.751.amzn2.x86_64   containerd://1.6.6
fargate-ip-10-0-187-27.ec2.internal    Ready    <none>   15m   v1.27.1-eks-2f008fe   10.0.187.27    <none>        Amazon Linux 2   5.10.186-179.751.amzn2.x86_64   containerd://1.6.6
fargate-ip-10-0-188-225.ec2.internal   Ready    <none>   15m   v1.27.1-eks-2f008fe   10.0.188.225   <none>        Amazon Linux 2   5.10.186-179.751.amzn2.x86_64   containerd://1.6.6
fargate-ip-10-0-189-234.ec2.internal   Ready    <none>   15m   v1.27.1-eks-2f008fe   10.0.189.234   <none>        Amazon Linux 2   5.10.186-179.751.amzn2.x86_64   containerd://1.6.6
fargate-ip-10-0-96-29.ec2.internal     Ready    <none>   15m   v1.27.1-eks-2f008fe   10.0.96.29     <none>        Amazon Linux 2   5.10.184-175.749.amzn2.x86_64   containerd://1.6.6
Next, lets verify the namespaces in the cluster:
```

```bash
kubectl get pods -o wide -A
```
```
NAMESPACE                       NAME                                                   READY   STATUS    RESTARTS       AGE   IP             NODE                                   NOMINATED NODE   READINESS GATES
cert-manager                    cert-manager-875c7579b-5kzg5                           1/1     Running   0              17m   10.0.188.225   fargate-ip-10-0-188-225.ec2.internal   <none>           <none>
cert-manager                    cert-manager-cainjector-7bb6786867-xrtbx               1/1     Running   0              17m   10.0.102.84    fargate-ip-10-0-102-84.ec2.internal    <none>           <none>
cert-manager                    cert-manager-webhook-79d574fbd5-9b7mx                  1/1     Running   0              17m   10.0.187.27    fargate-ip-10-0-187-27.ec2.internal    <none>           <none>
default                         otel-collector-cloudwatch-collector-65bb5d7cb6-x8gdl   1/1     Running   1 (114s ago)   14m   10.0.132.165   fargate-ip-10-0-132-165.ec2.internal   <none>           <none>
default                         otel-collector-xray-collector-796b57b657-tnx86         1/1     Running   0              14m   10.0.124.175   fargate-ip-10-0-124-175.ec2.internal   <none>           <none>
kube-system                     aws-load-balancer-controller-8dcffbf6c-6qgfn           1/1     Running   0              17m   10.0.96.29     fargate-ip-10-0-96-29.ec2.internal     <none>           <none>
kube-system                     aws-load-balancer-controller-8dcffbf6c-dgqn6           1/1     Running   0              17m   10.0.189.234   fargate-ip-10-0-189-234.ec2.internal   <none>           <none>
kube-system                     blueprints-addon-metrics-server-6765c9bc59-v98h5       1/1     Running   0              17m   10.0.175.87    fargate-ip-10-0-175-87.ec2.internal    <none>           <none>
kube-system                     coredns-788dbcccd5-7lf2g                               1/1     Running   0              17m   10.0.173.57    fargate-ip-10-0-173-57.ec2.internal    <none>           <none>
kube-system                     coredns-788dbcccd5-wn8nc                               1/1     Running   0              17m   10.0.126.244   fargate-ip-10-0-126-244.ec2.internal   <none>           <none>
kube-system                     kube-state-metrics-7f4b8b9f5-g994r                     1/1     Running   0              17m   10.0.159.96    fargate-ip-10-0-159-96.ec2.internal    <none>           <none>
opentelemetry-operator-system   opentelemetry-operator-5fbdd4f5f9-lm2nf                2/2     Running   0              16m   10.0.170.28    fargate-ip-10-0-170-28.ec2.internal    <none>           <none>
```

```bash
kubectl get ns # Output shows all namespace
```
```
NAME                       STATUS   AGE
aws-for-fluent-bit              Active   17m
cert-manager                    Active   17m
default                         Active   27m
kube-node-lease                 Active   27m
kube-public                     Active   27m
kube-system                     Active   27m
opentelemetry-operator-system   Active   17m
```

## Viewing Logs

By default, we deploy a FluentBit daemon set in the cluster to collect worker logs for all namespaces. Logs are collected and exported to Amazon CloudWatch Logs, which enables you to centralize the logs from all of your systems, applications,
and AWS services that you use, in a single, highly scalable service.

## Using CloudWatch Logs Insights to Query Logs

Navigate to CloudWatch, then go to "Logs Insights"

In the dropdown, select any of the logs that begin with "/aws/eks/single-new-eks-awsnative-fargate-observability-accelerator" and run a query.

Example with "kubesystem" log group:

![logs-query](../images/logs-fargate-1.png)

Then you can view the results of your query:

![logs-results](../images/logs-fargate-2.png)

## Viewing Metrics

Metrics are collected by the cloudWatchAdotAddon as based on the metricsNameSelectors we defined (default `['apiserver_request_.*', 'container_memory_.*', 'container_threads', 'otelcol_process_.*']`). These metrics can be found in the Cloudwatch metrics dashboard. 

Navigate to Cloudwatch, then go to "Metrics"

Select "All Metrics" from the dropdown and select any logs in the ContainerInsights namespace

Example with "EKS_Cluster" metrics

![metrics](../images/metrics-fargate-1.png)

## Teardown

You can teardown the whole CDK stack with the following command:

```bash
make pattern single-new-eks-awsnative-fargate-observability destroy
```