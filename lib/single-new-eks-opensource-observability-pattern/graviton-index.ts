import { Construct } from 'constructs';
import { utils } from '@aws-quickstart/eks-blueprints';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { GrafanaOperatorSecretAddon } from './grafanaoperatorsecretaddon';
import * as amp from 'aws-cdk-lib/aws-aps';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { ObservabilityBuilder } from '@aws-quickstart/eks-blueprints';

export default class SingleNewEksGravitonOpenSourceObservabilityPattern {
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

        // All Grafana Dashboard URLs from `cdk.json` if present
        const fluxRepository: blueprints.FluxGitRepo = utils.valueFromContext(scope, "fluxRepository", undefined);
        fluxRepository.values!.AMG_AWS_REGION = region;
        fluxRepository.values!.AMP_ENDPOINT_URL = ampEndpoint;
        fluxRepository.values!.AMG_ENDPOINT_URL = amgEndpointUrl;

        const ampAddOnProps: blueprints.AmpAddOnProps = {
            ampPrometheusEndpoint: ampEndpoint,
            ampRules: {
                ampWorkspaceArn: ampWorkspaceArn,
                ruleFilePaths: [
                    __dirname + '/../common/resources/amp-config/alerting-rules.yml',
                    __dirname + '/../common/resources/amp-config/recording-rules.yml'
                ]
            }
        };

        if (utils.valueFromContext(scope, "java.pattern.enabled", false)) {
            ampAddOnProps.openTelemetryCollector = {
                manifestPath: __dirname + '/../common/resources/otel-collector-config.yml',
                manifestParameterMap: {
                    javaScrapeSampleLimit: 1000,
                    javaPrometheusMetricsEndpoint: "/metrics"
                }
            };
            ampAddOnProps.ampRules?.ruleFilePaths.push(
                __dirname + '/../common/resources/amp-config/java/alerting-rules.yml',
                __dirname + '/../common/resources/amp-config/java/recording-rules.yml'
            );
        }

        Reflect.defineMetadata("ordered", true, blueprints.addons.GrafanaOperatorAddon);
        const addOns: Array<blueprints.ClusterAddOn> = [
            // new blueprints.addons.KubeProxyAddOn("v1.27.1-eksbuild.1"),
            new blueprints.addons.CloudWatchLogsAddon({
                logGroupPrefix: `/aws/eks/${stackId}`,
                logRetentionDays: 30
            }),
            // new blueprints.addons.AmpAddOn(ampAddOnProps),
            new blueprints.addons.XrayAdotAddOn(),
            new blueprints.addons.FluxCDAddOn({"repositories": [fluxRepository]}),
            new GrafanaOperatorSecretAddon(),
        ];

        const mngProps: blueprints.MngClusterProviderProps = {
            version: eks.KubernetesVersion.of("1.27"),
            instanceTypes: [new ec2.InstanceType("m7g.large")],
            amiType: eks.NodegroupAmiType.AL2_ARM_64,
        };

        ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .version('auto')
            .enableOpenSourcePatternAddOns(ampEndpoint)
            .resourceProvider(ampWorkspaceName, new blueprints.CreateAmpProvider(ampWorkspaceName, ampWorkspaceName))
            .clusterProvider(new blueprints.MngClusterProvider(mngProps))
            .addOns(...addOns)
            .build(scope, stackId);
    }
}
