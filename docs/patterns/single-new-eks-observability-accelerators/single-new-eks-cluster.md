# Single New EKS Cluster Observability Accelerator

## Objective

This pattern deploys one production grade Amazon EKS cluster, without any Observability add-on.

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
make pattern single-new-eks-cluster deploy
```

## Verify the resources

Run update-kubeconfig command. You should be able to get the command from CDK output message.

```bash
aws eks update-kubeconfig --name single-new-eks-observability-accelerator --region <your region> --role-arn arn:aws:iam::xxxxxxxxx:role/single-new-eks-observabil-singleneweksobservabilit-5NW0A5AUXVS9
```

Let’s verify the resources created by steps above.

```bash
kubectl get nodes -o wide
```
Output:

```console
NAME                                            STATUS   ROLES    AGE     VERSION               INTERNAL-IP    EXTERNAL-IP   OS-IMAGE         KERNEL-VERSION                  CONTAINER-RUNTIME
ip-10-0-157-151.eu-central-1.compute.internal   Ready    <none>   9m19s   v1.25.9-eks-0a21954   10.0.157.151   <none>        Amazon Linux 2   5.10.179-168.710.amzn2.x86_64   containerd://1.6.19
```

Next, lets verify the namespaces in the cluster:

```bash
kubectl get ns # Output shows all namespace
```

Output:

```console
NAME                       STATUS   AGE
cert-manager               Active   7m8s
default                    Active   13m
external-secrets           Active   7m9s
kube-node-lease            Active   13m
kube-public                Active   13m
kube-system                Active   13m
prometheus-node-exporter   Active   7m9s
```

## Teardown

You can teardown the whole CDK stack with the following command:

```bash
make pattern single-new-eks-cluster destroy
```

aws