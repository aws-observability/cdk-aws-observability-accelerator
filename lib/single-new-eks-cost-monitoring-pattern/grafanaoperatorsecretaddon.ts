import 'source-map-support/register';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import * as eks from "aws-cdk-lib/aws-eks";
import { ManagedPolicy } from "aws-cdk-lib/aws-iam";
import { Construct } from 'constructs';
import { createNamespace, dependable } from '@aws-quickstart/eks-blueprints/dist/utils';

export class GrafanaOperatorSecretAddon implements blueprints.ClusterAddOn {
    id?: string | undefined;
    @dependable(blueprints.addons.ExternalsSecretsAddOn.name, blueprints.addons.GrafanaOperatorAddon.name)
    deploy(clusterInfo: blueprints.ClusterInfo): void | Promise<Construct> {
        const cluster = clusterInfo.cluster;
        
        const serviceAccount1 = cluster.addServiceAccount("kubecost-cost-analyzer-amp", {
            name: "kubecost-cost-analyzer-amp",
            namespace: "kubecost"
        });
        
        const policy1 = ManagedPolicy.fromAwsManagedPolicyName("AmazonPrometheusQueryAccess");
        serviceAccount1.role.addManagedPolicy(policy1);

        const policy2 = ManagedPolicy.fromAwsManagedPolicyName("AmazonPrometheusRemoteWriteAccess");
        serviceAccount1.role.addManagedPolicy(policy2);

        const serviceAccount2 = cluster.addServiceAccount("kubecost-prometheus-server-amp", {
            name: "kubecost-prometheus-server-amp",
            namespace: "kubecost"
        });

        const policy3 = ManagedPolicy.fromAwsManagedPolicyName("AmazonPrometheusQueryAccess");
        serviceAccount2.role.addManagedPolicy(policy3);

        const policy4 = ManagedPolicy.fromAwsManagedPolicyName("AmazonPrometheusRemoteWriteAccess");
        serviceAccount2.role.addManagedPolicy(policy4);

        const namespace = createNamespace("kubecost",cluster);
        
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
        
        const externalSecret = new eks.KubernetesManifest(clusterInfo.cluster.stack, "ExternalSecret", {
            cluster: cluster,
            manifest: [
                {
                    apiVersion: "external-secrets.io/v1beta1",
                    kind: "ExternalSecret",
                    metadata: {
                        name: "external-grafana-admin-credentials",
                        namespace: "grafana-operator"
                    },
                    spec: {
                        secretStoreRef: {
                            name: "ssm-parameter-store",
                            kind: "ClusterSecretStore",
                        },
                        target: {
                            name: "grafana-admin-credentials"
                        },
                        data: [
                            {
                                secretKey: "GF_SECURITY_ADMIN_APIKEY",
                                remoteRef: {
                                    key: "/cdk-accelerator/grafana-api-key"
                                },
                            },
                        ],
                    },
                },
            ],
        });
        externalSecret.node.addDependency(secretStore);
        return Promise.resolve(secretStore);
    }
}