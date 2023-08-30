import { Construct } from 'constructs';
import { utils } from '@aws-quickstart/eks-blueprints';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { GrafanaOperatorSecretAddon } from './grafanaoperatorsecretaddon';
import * as amp from 'aws-cdk-lib/aws-aps';
import { ObservabilityBuilder } from '@aws-quickstart/eks-blueprints';
//import { cloudWatchDeploymentMode } from '@aws-quickstart/eks-blueprints';
import * as eks from 'aws-cdk-lib/aws-eks';


export default class SingleNewEksFargateOpenSourceObservabilityConstruct {
    constructor(scope: Construct, id: string) {
        const stackId = `${id}-observability-accelerator-11`;


        const account = process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;
        const ampWorkspaceName = process.env.COA_AMP_WORKSPACE_NAME! || 'observability-amp-Workspace';
        const ampWorkspace = blueprints.getNamedResource(ampWorkspaceName) as unknown as amp.CfnWorkspace;
        const ampEndpoint = ampWorkspace.attrPrometheusEndpoint;
        const ampWorkspaceArn = ampWorkspace.attrArn;

        const amgEndpointUrl = process.env.COA_AMG_ENDPOINT_URL;

        // assert(amgEndpointUrl, "AMG Endpoint URL environmane variable COA_AMG_ENDPOINT_URL is mandatory");

        // All Grafana Dashboard URLs from `cdk.json`
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
            new blueprints.addons.VpcCniAddOn(),
            new blueprints.addons.CoreDnsAddOn({
                version: "v1.10.1-eksbuild.1",
                configurationValues: { computeType: "Fargate" }
            }),
            new blueprints.addons.KubeProxyAddOn(),
            new blueprints.addons.AwsLoadBalancerControllerAddOn(),
            new blueprints.addons.CertManagerAddOn({
                installCRDs: true,
                createNamespace: true,
                namespace: "cert-manager",
                values: { webhook: { securePort: 10260 } }
            }),
            new blueprints.addons.CloudWatchLogsAddon({
                logGroupPrefix: `/aws/eks/${stackId}`,
                logRetentionDays: 30
            }),
            new blueprints.addons.ExternalsSecretsAddOn({
                namespace: "external-secrets",
                values: { webhook: { port: 9443 } }
            }),
            new blueprints.addons.GrafanaOperatorAddon({
                version: 'v5.0.0-rc3'
            }),
            new blueprints.addons.FluxCDAddOn({"repositories": [fluxRepository]}),
            new GrafanaOperatorSecretAddon(),
            new blueprints.addons.AdotCollectorAddOn(),
            new blueprints.addons.AmpAddOn(ampAddOnProps)
        ];


        const fargateProfiles: Map<string, eks.FargateProfileOptions> = new Map([
            ["MyProfile", {
                selectors: [
                { namespace: "cert-manager" },
                { namespace: "opentelemetry-operator-system" },
                { namespace: "external-secrets" },
                { namespace: "grafana-operator" },
                { namespace: "flux-system" }
                ]
            }]
        ]);

        // Define fargate cluster provider and pass the profile options
        const fargateClusterProvider: blueprints.FargateClusterProvider = new blueprints.FargateClusterProvider({
            fargateProfiles,
            version: eks.KubernetesVersion.of("1.27")
        });

        ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            //.version('auto')
            .clusterProvider(fargateClusterProvider)
            .resourceProvider(ampWorkspaceName, new blueprints.CreateAmpProvider(ampWorkspaceName, ampWorkspaceName))
            //.enableOpenSourcePatternAddOns(ampAddOnProps)
            .addOns(...addOns)
            .build(scope, stackId);
    }
}
