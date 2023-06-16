import { Construct } from 'constructs';
import { EksBlueprint, utils } from '@aws-quickstart/eks-blueprints';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { GrafanaOperatorSecretAddon } from './grafanaoperatorsecretaddon';
import * as amp from 'aws-cdk-lib/aws-aps';
import * as assert from "assert";

export default class SingleNewEksOpenSourceobservabilityConstruct {
    constructor(scope: Construct, id: string) {
        // AddOns for the cluster
        const stackId = `${id}-observability-accelerator`;
        // All Grafana Dashboard Default URLs
        const clusterDefaultDashUrl = "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/cluster.json";
        const kubeletDefaultDashUrl = "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/kubelet.json";
        const namespaceWorkloadsDefaultDashUrl = "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/namespace-workloads.json";
        const nodeExporterDefaultDashUrl = "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/nodeexporter-nodes.json";
        const nodesDefaultDashUrl = "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/nodes.json";
        const workloadsDefaultDashUrl = "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/workloads.json";

        const account = process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;
        const ampWorkspaceName = process.env.COA_AMP_WORKSPACE_NAME! || 'observability-amp-Workspace';
        const ampPrometheusEndpoint = (blueprints.getNamedResource(ampWorkspaceName) as unknown as amp.CfnWorkspace).attrPrometheusEndpoint;
        
        const amgEndpointUrl = process.env.COA_AMG_ENDPOINT_URL;

        // All Grafana Dashboard URLs from `cdk.json` if present
        const clusterDashUrl: string = utils.valueFromContext(scope, "cluster.dashboard.url", clusterDefaultDashUrl);
        const kubeletDashUrl: string = utils.valueFromContext(scope, "kubelet.dashboard.url", kubeletDefaultDashUrl);
        const namespaceWorkloadsDashUrl: string = utils.valueFromContext(scope, "cluster.dashboard.url", namespaceWorkloadsDefaultDashUrl);
        const nodeExporterDashUrl: string = utils.valueFromContext(scope, "kubelet.dashboard.url", nodeExporterDefaultDashUrl);
        const nodesDashUrl: string = utils.valueFromContext(scope, "cluster.dashboard.url", nodesDefaultDashUrl);
        const workloadsDashUrl: string = utils.valueFromContext(scope, "kubelet.dashboard.url", workloadsDefaultDashUrl);

        Reflect.defineMetadata("ordered", true, blueprints.addons.GrafanaOperatorAddon);
        const addOns: Array<blueprints.ClusterAddOn> = [
            new blueprints.addons.AwsLoadBalancerControllerAddOn(),
            new blueprints.addons.VpcCniAddOn(),
            new blueprints.addons.CoreDnsAddOn(),
            new blueprints.addons.KubeProxyAddOn(),
            new blueprints.addons.CertManagerAddOn(),
            new blueprints.addons.ExternalsSecretsAddOn(),
            new blueprints.addons.PrometheusNodeExporterAddOn(),
            new blueprints.addons.KubeStateMetricsAddOn(),
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

        EksBlueprint.builder()
            .account(account)
            .region(region)
            .resourceProvider(ampWorkspaceName, new blueprints.CreateAmpProvider(ampWorkspaceName, ampWorkspaceName))
            .addOns(...addOns)
            .build(scope, stackId);
    }
}
