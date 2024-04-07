# Single Cluster Observability - Kubecost Cost Monitoring with Secure Ingress using Cognito

Implementing Kubecost for monitoring EKS clusters provides invaluable insights into resource utilization and cost management. Kubecost offers granular visibility into the cost breakdown of Kubernetes workloads, enabling efficient allocation of resources and optimization of infrastructure spending. By integrating with Amazon Managed Prometheus (AMP) and AWS services such as Application Load Balancer, Amazon Cognito, and Amazon Route 53, Kubecost ensures a comprehensive monitoring solution with secure access control mechanisms. With alerts and recording rules provided by Amazon Managed Service for Prometheus, teams can proactively identify and address potential issues, ensuring optimal performance and cost-effectiveness of EKS deployments. Kubecost's user-friendly dashboard and reporting capabilities empower organizations to make informed decisions, maximize resource efficiency, and maintain cost predictability in their EKS environments, ultimately enhancing operational excellence and driving business growth.

## Architecture

The following figure illustrates the architecture of the pattern we will be deploying for Single EKS cost monitoring (Kubecost) pattern with Application Load Balancer, Amazon Cognito, and a Transport Layer Security (TLS) Certificate on AWS Certificate Manager (ACM) with Amazon Route 53 hosted zone to authenticate users to Kubecost

![Architecture](../images/costmonitoring-ingress.png)

## Objective

- Deploys one production grade Amazon EKS cluster.
- AWS Kubecost with Amazon Managed Prometheus (AMP) integration
- [Secure Ingress with AWS Cognito](https://aws.amazon.com/blogs/containers/securing-kubecost-access-with-amazon-cognito/)
- AWS Certificate Manager with Amazon Route 53 hosted zone 
- Alerts and recording rules with Amazon Managed Service for Prometheus

## Prerequisites:

An existing hosted zone in Route53 with the ability to add records.

Ensure that you have installed the following tools on your machine.

1. [aws cli](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
2. [kubectl](https://Kubernetes.io/docs/tasks/tools/)
3. [cdk](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_install)
4. [npm](https://docs.npmjs.com/cli/v8/commands/npm-install)

## Configuring domain

The CDK code expects the allowed domain and subdomain names in the CDK context file (cdk.json).

Create two environment variables. The PARENT_HOSTED_ZONE variable contains the name of your Route 53 public hosted zone. The DEV_SUBZONE_NAME will be the address for your Kubecost dashboard.

When users register to cognito they will have to provide an email address, using the `allowed.domains.list` you can specify you enterprise's email domain to only allow your employees to sign up for the service

Generate the cdk.json file:

```bash
PARENT_HOSTED_ZONE=mycompany.a2z.com
DEV_SUBZONE_NAME=kubecost.mycompany.a2z.com
ALLOWED_DOMAIN_LIST=amazon.com
cat << EOF > cdk.json
{
    "app": "npx ts-node dist/lib/common/default-main.js",
    "context": {
        "parent.hostedzone.name": "${PARENT_HOSTED_ZONE}",
        "dev.subzone.name": "${DEV_SUBZONE_NAME}",
        "allowed.domains.list": "${ALLOWED_DOMAIN_LIST}"
      }
}
EOF
```


## Deploying

Please follow the _Deploying_ instructions of the [New EKS Cluster Open Source Observability Accelerator](./single-new-eks-opensource-observability.md) pattern till step 7.
At step 8, execute the following

```bash
make build
make pattern single-new-eks-cost-monitoring deploy single-new-eks-cost-monitoring-observability-accelerator
```

## Updating CNAME record for Route53

Open the AWS console once the deployment is complete. 
Navigate to EC2>AWS Load Balancer. Select the newly created load balancer and copy to the DNS A Record to your clipboard.
Navigate to Route53 in AWS console and select the hosted zone you want to use for the deployment. 
Add new CNAME record type. 
Set name as the DEV_SUBZONE_NAME defined previously and value as the load balancer DNS A record copied to your clipboard.
Wait 60 seconds for DNS to get propogated.

## Verify the resources

Run update-kubeconfig command. You should be able to get the command from CDK output message.

```bash
aws eks update-kubeconfig --name single-new-eks-fargate-opensource-observability-accelerator --region <your region> --role-arn arn:aws:iam::xxxxxxxxx:role/single-new-eks-fargate-op-singleneweksfargateopens-xxxxxxxx
```


Let’s verify the resources created by steps above.

```bash
kubectl get pods -o wide -A
```

Now, lets navigate to the URL described as our dev.subzone.name in the cdk.json file and signup with a new cognito user profile.

## Teardown

You can teardown the whole CDK stack with the following command:

```bash
make pattern single-new-eks-cost-monitoring destroy
```