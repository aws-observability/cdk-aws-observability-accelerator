import { Construct } from 'constructs';
import { utils } from '@aws-quickstart/eks-blueprints';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { GrafanaOperatorSecretAddon } from './grafanaoperatorsecretaddon';
import * as amp from 'aws-cdk-lib/aws-aps';
import { ObservabilityBuilder } from '../common/observability-builder';


export default class SingleNewEksOpenSourceobservabilityConstruct {
    constructor(scope: Construct, id: string) {
        // AddOns for the cluster
        const stackId = `${id}-observability-accelerator`;

        const account = process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;
        const ampWorkspaceName = process.env.COA_AMP_WORKSPACE_NAME! || 'observability-amp-Workspace';
        const ampPrometheusEndpoint = (blueprints.getNamedResource(ampWorkspaceName) as unknown as amp.CfnWorkspace).attrPrometheusEndpoint;
        
        const amgEndpointUrl = process.env.COA_AMG_ENDPOINT_URL;

        // assert(amgEndpointUrl, "AMG Endpoint URL environmane variable COA_AMG_ENDPOINT_URL is mandatory");

        // All Grafana Dashboard URLs from `cdk.json` if presentgi
        const clusterDashUrl: string = utils.valueFromContext(scope, "cluster.dashboard.url", undefined);
        const kubeletDashUrl: string = utils.valueFromContext(scope, "kubelet.dashboard.url", undefined);
        const namespaceWorkloadsDashUrl: string = utils.valueFromContext(scope, "namespaceworkloads.dashboard.url", undefined);
        const nodeExporterDashUrl: string = utils.valueFromContext(scope, "nodeexporter.dashboard.url", undefined);
        const nodesDashUrl: string = utils.valueFromContext(scope, "nodes.dashboard.url", undefined);
        const workloadsDashUrl: string = utils.valueFromContext(scope, "workloads.dashboard.url", undefined);
        const apiServerBasicDashUrl: string = utils.valueFromContext(scope, "apiserver.basic.dashboard.url", undefined);
        const apiServerAdvancedDashUrl: string = utils.valueFromContext(scope, "apiserver.advanced.dashboard.url", undefined);
        const apiServerTroubleshootingDashUrl: string = utils.valueFromContext(scope, "apiserver.troubleshooting.dashboard.url", undefined);

        Reflect.defineMetadata("ordered", true, blueprints.addons.GrafanaOperatorAddon);
        const addOns: Array<blueprints.ClusterAddOn> = [
            new blueprints.addons.KubeProxyAddOn(),
            new blueprints.addons.AwsLoadBalancerControllerAddOn(),
            new blueprints.addons.CertManagerAddOn(),
            new blueprints.addons.CloudWatchLogsAddon({
                logGroupPrefix: `/aws/eks/${stackId}`,
                logRetentionDays: 30
            }),
            new blueprints.addons.AdotCollectorAddOn(),
            new blueprints.addons.AmpAddOn({
                ampPrometheusEndpoint: ampPrometheusEndpoint,
            }),
            new blueprints.addons.XrayAdotAddOn(),
            new blueprints.addons.ExternalsSecretsAddOn(),
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
                    "GRAFANA_WORKLOADS_DASH_URL" : workloadsDashUrl,
                    "GRAFANA_APISERVER_BASIC_DASH_URL": apiServerBasicDashUrl,
                    "GRAFANA_APISERVER_ADVANCED_DASH_URL": apiServerAdvancedDashUrl,
                    "GRAFANA_APISERVER_TROUBLESHOOTING_DASH_URL": apiServerTroubleshootingDashUrl
                },
            }),
            new GrafanaOperatorSecretAddon(),
        ];

        ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .addNewClusterObservabilityBuilderAddOns()
            .resourceProvider(ampWorkspaceName, new blueprints.CreateAmpProvider(ampWorkspaceName, ampWorkspaceName))
            .addOns(...addOns)
            .build(scope, stackId);
    }
}
