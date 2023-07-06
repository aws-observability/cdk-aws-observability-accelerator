// import { Construct } from 'constructs';
import { ImportClusterProvider, utils } from '@aws-quickstart/eks-blueprints';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { GrafanaOperatorSecretAddon } from './grafanaoperatorsecretaddon';
import * as amp from 'aws-cdk-lib/aws-aps';
import { ObservabilityBuilder } from '../common/observability-builder';
import * as cdk from "aws-cdk-lib";
import * as eks from 'aws-cdk-lib/aws-eks';

export default class ExistingEksOpenSourceobservabilityConstruct {
    async buildAsync(scope: cdk.App, id: string) {
        // AddOns for the cluster
        const stackId = `${id}-observability-accelerator`;
        const clusterName = utils.valueFromContext(scope, "existing.cluster.name", undefined);
        const kubectlRoleName = utils.valueFromContext(scope, "existing.kubectl.rolename", undefined);
        const kubectlRoleArn = utils.valueFromContext(scope, "existing.kubectl.rolearn", undefined);

        const account = process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;
        const ampWorkspaceName = process.env.COA_AMP_WORKSPACE_NAME! || 'observability-amp-Workspace';
        const ampPrometheusEndpoint = (blueprints.getNamedResource(ampWorkspaceName) as unknown as amp.CfnWorkspace).attrPrometheusEndpoint;
        
        const amgEndpointUrl = process.env.COA_AMG_ENDPOINT_URL;
        const sdkCluster = await blueprints.describeCluster(clusterName, region); // get cluster information using EKS APIs
        const vpcId = sdkCluster.resourcesVpcConfig?.vpcId;

        const importClusterProvider = new ImportClusterProvider({
            clusterName: sdkCluster.name!,
            version: eks.KubernetesVersion.of(sdkCluster.version!),
            clusterEndpoint: sdkCluster.endpoint,
            openIdConnectProvider: blueprints.getResource(context =>
                new blueprints.LookupOpenIdConnectProvider(sdkCluster.identity!.oidc!.issuer!).provide(context)),
            clusterCertificateAuthorityData: sdkCluster.certificateAuthority?.data,
            kubectlRoleArn: blueprints.getResource(context => new blueprints.LookupRoleProvider(kubectlRoleName).provide(context)).roleArn,
            clusterHandlerSecurityGroupId: sdkCluster.resourcesVpcConfig?.clusterSecurityGroupId
        });

        // /**
        //  * Assumes the supplied role is registered in the target cluster for kubectl access.
        //  */
        // const importClusterProvider = blueprints.ImportClusterProvider.fromClusterAttributes(
        //     sdkCluster, 
        //     blueprints.getResource(context => new blueprints.LookupRoleProvider(kubectlRoleName).provide(context)),
        // );

        // All Grafana Dashboard URLs from `cdk.json` if presentgi
        const clusterDashUrl: string = utils.valueFromContext(scope, "cluster.dashboard.url", undefined);
        const kubeletDashUrl: string = utils.valueFromContext(scope, "kubelet.dashboard.url", undefined);
        const namespaceWorkloadsDashUrl: string = utils.valueFromContext(scope, "namespaceworkloads.dashboard.url", undefined);
        const nodeExporterDashUrl: string = utils.valueFromContext(scope, "nodeexporter.dashboard.url", undefined);
        const nodesDashUrl: string = utils.valueFromContext(scope, "nodes.dashboard.url", undefined);
        const workloadsDashUrl: string = utils.valueFromContext(scope, "workloads.dashboard.url", undefined);

        Reflect.defineMetadata("ordered", true, blueprints.addons.GrafanaOperatorAddon);
        const addOns: Array<blueprints.ClusterAddOn> = [
            new blueprints.addons.KubeProxyAddOn(),
            new blueprints.addons.CloudWatchLogsAddon({
                logGroupPrefix: `/aws/eks/${stackId}`,
                logRetentionDays: 30
            }),
            new blueprints.addons.AdotCollectorAddOn(),
            new blueprints.addons.AmpAddOn({
                ampPrometheusEndpoint: ampPrometheusEndpoint,
            }),
            new blueprints.addons.XrayAdotAddOn(),
            new blueprints.addons.GrafanaOperatorAddon({
                version: 'v5.0.0-rc3'
            }),
            new blueprints.addons.FluxCDAddOn({
                bootstrapRepo: {
                    repoUrl: 'https://github.com/aws-observability/aws-observability-accelerator',
                    name: "grafana-dashboards",
                    targetRevision: "main",
                    path: "./artifacts/grafana-operator-manifests/eks/infrastructure"
                },
                fluxTargetNamespace: "grafana-operator",
                bootstrapValues: {
                    "AMG_AWS_REGION": region,
                    "AMP_ENDPOINT_URL": ampPrometheusEndpoint,
                    "AMG_ENDPOINT_URL": amgEndpointUrl,
                    "GRAFANA_CLUSTER_DASH_URL" : clusterDashUrl,
                    "GRAFANA_KUBELET_DASH_URL" : kubeletDashUrl,
                    "GRAFANA_NSWRKLDS_DASH_URL" : namespaceWorkloadsDashUrl,
                    "GRAFANA_NODEEXP_DASH_URL" : nodeExporterDashUrl,
                    "GRAFANA_NODES_DASH_URL" : nodesDashUrl,
                    "GRAFANA_WORKLOADS_DASH_URL" : workloadsDashUrl
                },
            }),
            new GrafanaOperatorSecretAddon(),
        ];

        ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .clusterProvider(importClusterProvider)
            .resourceProvider(blueprints.GlobalResources.Vpc, new blueprints.VpcProvider(vpcId)) // this is required with import cluster provider
            .resourceProvider(ampWorkspaceName, new blueprints.CreateAmpProvider(ampWorkspaceName, ampWorkspaceName))
            .addOns(...addOns)
            .build(scope, stackId);
    }
}
