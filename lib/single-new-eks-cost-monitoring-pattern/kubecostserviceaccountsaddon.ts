import 'source-map-support/register';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import * as eks from "aws-cdk-lib/aws-eks";
import { ManagedPolicy } from "aws-cdk-lib/aws-iam";
import { Construct } from 'constructs';


export class KubecostServiceAccountsAddon implements blueprints.ClusterAddOn {
    id?: string | undefined;
    @blueprints.utils.dependable(blueprints.addons.ExternalsSecretsAddOn.name)
    deploy(clusterInfo: blueprints.ClusterInfo): void | Promise<Construct> {
        const cluster = clusterInfo.cluster;

        const policyRead = ManagedPolicy.fromAwsManagedPolicyName("AmazonPrometheusQueryAccess");
        const policyWrite = ManagedPolicy.fromAwsManagedPolicyName("AmazonPrometheusRemoteWriteAccess");
        const policyEC2 = ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2ReadOnlyAccess"); // Needed since kubecost cost analyzer needs to access ec2:DescribeVolumes

        const serviceAccount1 = cluster.addServiceAccount("kubecost-cost-analyzer-amp", {
            name: "kubecost-cost-analyzer-amp",
            namespace: "kubecost"
        });


        serviceAccount1.role.addManagedPolicy(policyRead);
        serviceAccount1.role.addManagedPolicy(policyWrite);
        serviceAccount1.role.addManagedPolicy(policyEC2);

        const serviceAccount2 = cluster.addServiceAccount("kubecost-prometheus-server-amp", {
            name: "kubecost-prometheus-server-amp",
            namespace: "kubecost"
        });

        serviceAccount2.role.addManagedPolicy(policyRead);
        serviceAccount2.role.addManagedPolicy(policyWrite);

        const namespace = blueprints.utils.createNamespace("kubecost",cluster);

        serviceAccount1.node.addDependency(namespace);
        serviceAccount2.node.addDependency(namespace);

        const secretStore = new eks.KubernetesManifest(clusterInfo.cluster.stack, "ClusterSecretStore", {
            cluster: cluster,
            manifest: [
                {
                    apiVersion: "external-secrets.io/v1beta1",
                    kind: "ClusterSecretStore",
                    metadata: {
                        name: "ssm-parameter-store",
                        namespace: "default"
                    },
                    spec: {
                        provider: {
                            aws: {
                                service: "ParameterStore",
                                region: clusterInfo.cluster.stack.region,
                                auth: {
                                    jwt: {
                                        serviceAccountRef: {
                                            name: "external-secrets-sa",
                                            namespace: "external-secrets",
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            ],
        });


        return Promise.resolve(secretStore);
    }
} 