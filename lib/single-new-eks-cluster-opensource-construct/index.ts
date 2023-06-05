import { Construct } from 'constructs';
import { EksBlueprint } from '@aws-quickstart/eks-blueprints';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { GrafanaOperatorSecretAddon } from './grafanaoperatorsecretaddon';
import * as amp from 'aws-cdk-lib/aws-aps';
const assert = require('assert').strict

export default class SingleNewEksClusterOpenSourceConstruct {
    constructor(scope: Construct, id: string) {
        // AddOns for the cluster
        const stackId = `${id}-observability-accelerator`;

        const account = process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;
        const clusterName = process.env.COA_CLUSTER_NAME! || 'observability-accelarator-cluster';
        const ampWorkspaceName = process.env.COA_AMP_WORKSPACE_NAME! || 'observability-amp-Workspace';
        const ampPrometheusEndpoint = (blueprints.getNamedResource(ampWorkspaceName) as unknown as amp.CfnWorkspace).attrPrometheusEndpoint;
        
        const amgEndpointUrl = process.env.COA_AMG_ENDPOINT_URL;
        assert.ok(amgEndpointUrl, 'The "amgEndpointUrl" environment variable needs to be populated with AMG URL Endpoint');

        // All Grafana Dashboard URLs
        const clusterDashUrl = "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/1d731aca31cdeb26e9fe9d017e609a5ba1621a30/artifacts/grafana-dashboards/cluster.json"
        const kubeletDashUrl = "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/1d731aca31cdeb26e9fe9d017e609a5ba1621a30/artifacts/grafana-dashboards/kubelet.json"
        const namespaceWorkloadsDashUrl = "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/1d731aca31cdeb26e9fe9d017e609a5ba1621a30/artifacts/grafana-dashboards/namespace-workloads.json"
        const nodeExporterDashUrl = "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/1d731aca31cdeb26e9fe9d017e609a5ba1621a30/artifacts/grafana-dashboards/nodeexporter-nodes.json"
        const nodesDashUrl = "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/1d731aca31cdeb26e9fe9d017e609a5ba1621a30/artifacts/grafana-dashboards/nodes.json"
        const workloadsDashUrl = "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/1d731aca31cdeb26e9fe9d017e609a5ba1621a30/artifacts/grafana-dashboards/workloads.json"

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
            new blueprints.addons.AdotCollectorAddOn(),
            new blueprints.addons.AmpAddOn({
                ampPrometheusEndpoint: ampPrometheusEndpoint,
            }),
            new blueprints.addons.GrafanaOperatorAddon({
                version: 'v5.0.0-rc3'
            }),
            new blueprints.addons.FluxCDAddOn({
                bootstrapRepo: {
                    repoUrl: 'https://github.com/aws-observability/aws-observability-accelerator',
                    name: "grafana-dashboards",
                    targetRevision: "feature/allDashboards",
                    path: "./artifacts/grafana-operator-manifests"
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
