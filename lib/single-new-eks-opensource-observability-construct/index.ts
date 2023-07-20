import { Construct } from 'constructs';
import { utils } from '@aws-quickstart/eks-blueprints';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { GrafanaOperatorSecretAddon } from './grafanaoperatorsecretaddon';
import * as amp from 'aws-cdk-lib/aws-aps';
import { ObservabilityBuilder } from '../common/observability-builder';
import { AmpRulesConfiguratorAddOn } from '../common/addons/amp-rules-configurator/amp-rules-configurator-addon';

export default class SingleNewEksOpenSourceobservabilityConstruct {
    constructor(scope: Construct, id: string) {
        // AddOns for the cluster
        const stackId = `${id}-observability-accelerator`;

        const account = process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;
        const ampWorkspaceName = process.env.COA_AMP_WORKSPACE_NAME! || 'observability-amp-Workspace';
        const ampWorkspace = blueprints.getNamedResource(ampWorkspaceName) as unknown as amp.CfnWorkspace;
        const ampEndpoint = ampWorkspace.attrPrometheusEndpoint;
        const ampWorkspaceArn = ampWorkspace.attrArn;
        
        const amgEndpointUrl = process.env.COA_AMG_ENDPOINT_URL;

        // assert(amgEndpointUrl, "AMG Endpoint URL environmane variable COA_AMG_ENDPOINT_URL is mandatory");

        // All Grafana Dashboard URLs from `cdk.json`
        const grafanaGitOpsConfig: blueprints.FluxCDAddOnProps = utils.valueFromContext(scope, "grafanaGitOpsConfig", undefined);
        grafanaGitOpsConfig.bootstrapValues!.AMG_AWS_REGION = region;
        grafanaGitOpsConfig.bootstrapValues!.AMP_ENDPOINT_URL = ampEndpoint;
        grafanaGitOpsConfig.bootstrapValues!.AMG_ENDPOINT_URL = amgEndpointUrl;

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
                ampPrometheusEndpoint: ampEndpoint,
                openTelemetryCollectorManifestPath: __dirname + '/../common/resources/otel-collector-config.yml',
                openTelemetryCollectorManifestParameterMap: {
                    javaScrapeSampleLimit: 1000,
                    javaPrometheusMetricsEndpoint: "/metrics"
                }
            }),
            new AmpRulesConfiguratorAddOn({
                ampWorkspaceArn: ampWorkspaceArn,
                ruleFilePaths: [
                    __dirname + '/../common/addons/amp-rules-configurator/alerting-rules.yml',
                    __dirname + '/../common/addons/amp-rules-configurator/recording-rules.yml'
                ]
            }),
            new blueprints.addons.XrayAdotAddOn(),
            new blueprints.addons.ExternalsSecretsAddOn(),
            new blueprints.addons.GrafanaOperatorAddon({
                version: 'v5.0.0-rc3'
            }),
            new blueprints.addons.FluxCDAddOn(grafanaGitOpsConfig),
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
