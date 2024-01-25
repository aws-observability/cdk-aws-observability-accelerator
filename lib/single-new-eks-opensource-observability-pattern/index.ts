import { Construct } from 'constructs';
import { utils } from '@aws-quickstart/eks-blueprints';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { GrafanaOperatorSecretAddon } from './grafanaoperatorsecretaddon';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as amp from 'aws-cdk-lib/aws-aps';
import { ObservabilityBuilder } from '@aws-quickstart/eks-blueprints';
import * as fs from 'fs';
import { IstioIngressGatewayHelmAddon } from './istio/istioIngressGatewayAddon';
import { IstioCniHelmAddon } from './istio/istiocniAddon';

export default class SingleNewEksOpenSourceobservabilityPattern {
    constructor(scope: Construct, id: string) {
        
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

        const jsonString = fs.readFileSync(__dirname + '/../../cdk.json', 'utf-8');
        const jsonStringnew = JSON.parse(jsonString);
        let doc = utils.readYamlDocument(__dirname + '/../common/resources/otel-collector-config.yml');
        doc = utils.changeTextBetweenTokens(
            doc,
            "{{ start enableJavaMonJob }}",
            "{{ stop enableJavaMonJob }}",
            jsonStringnew.context["java.pattern.enabled"]
        );
        doc = utils.changeTextBetweenTokens(
            doc,
            "{{ start enableNginxMonJob }}",
            "{{ stop enableNginxMonJob }}",
            jsonStringnew.context["nginx.pattern.enabled"]
        );
        doc = utils.changeTextBetweenTokens(
            doc,
            "{{ start enableIstioMonJob }}",
            "{{ stop enableIstioMonJob }}",
            jsonStringnew.context["istio.pattern.enabled"]
        );
        doc = utils.changeTextBetweenTokens(
            doc,
            "{{ start enableAPIserverJob }}",
            "{{ stop enableAPIserverJob }}",
            jsonStringnew.context["apiserver.pattern.enabled"]
        );
        doc = utils.changeTextBetweenTokens(
            doc,
            "{{ start enableAdotMetricsCollectionJob}}",
            "{{ stop enableAdotMetricsCollectionJob }}",
            jsonStringnew.context["adotcollectormetrics.pattern.enabled"]
        );
        doc = utils.changeTextBetweenTokens(
            doc,
            "{{ start enableAdotMetricsCollectionTelemetry }}",
            "{{ stop enableAdotMetricsCollectionTelemetry }}",
            jsonStringnew.context["adotcollectormetrics.pattern.enabled"]
        );
        console.log(doc);
        fs.writeFileSync(__dirname + '/../common/resources/otel-collector-config-new.yml', doc);

        if (utils.valueFromContext(scope, "java.pattern.enabled", false)) {
            ampAddOnProps.openTelemetryCollector = {
                manifestPath: __dirname + '/../common/resources/otel-collector-config-new.yml',
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

        if (utils.valueFromContext(scope, "apiserver.pattern.enabled", false)) {
            ampAddOnProps.enableAPIServerJob = true,
            ampAddOnProps.ampRules?.ruleFilePaths.push(
                __dirname + '/../common/resources/amp-config/apiserver/recording-rules.yml'
            );
        }

        if (utils.valueFromContext(scope, "nginx.pattern.enabled", false)) {
            ampAddOnProps.openTelemetryCollector = {
                manifestPath: __dirname + '/../common/resources/otel-collector-config-new.yml'
            };
            ampAddOnProps.ampRules?.ruleFilePaths.push(
                __dirname + '/../common/resources/amp-config/nginx/alerting-rules.yml'
            );
        }

        if (utils.valueFromContext(scope, "istio.pattern.enabled", false)) {
            ampAddOnProps.openTelemetryCollector = {
                manifestPath: __dirname + '/../common/resources/otel-collector-config-new.yml'
            };
            ampAddOnProps.ampRules?.ruleFilePaths.push(
                __dirname + '/../common/resources/amp-config/istio/alerting-rules.yml',
                __dirname + '/../common/resources/amp-config/istio/recording-rules.yml'
            );
        }

        Reflect.defineMetadata("ordered", true, blueprints.addons.GrafanaOperatorAddon);
        const addOns: Array<blueprints.ClusterAddOn> = [
            new blueprints.addons.CloudWatchLogsAddon({
                logGroupPrefix: `/aws/eks/${stackId}`,
                logRetentionDays: 30
            }),
            new blueprints.addons.XrayAdotAddOn(),
            new blueprints.addons.FluxCDAddOn({"repositories": [fluxRepository]}),
            new GrafanaOperatorSecretAddon()
        ];

        if (utils.valueFromContext(scope, "istio.pattern.enabled", false)) {
            addOns.push(new blueprints.addons.IstioBaseAddOn({
                version: "1.18.2"
            }));
            addOns.push(new blueprints.addons.IstioControlPlaneAddOn({
                version: "1.18.2"
            }));
            addOns.push(new IstioIngressGatewayHelmAddon);
            addOns.push(new IstioCniHelmAddon);
        }

        const mngProps: blueprints.MngClusterProviderProps = {
            version: eks.KubernetesVersion.of("1.28"),
            instanceTypes: [new ec2.InstanceType("m5.2xlarge")],
            amiType: eks.NodegroupAmiType.AL2_X86_64,
            desiredSize: 2,
            maxSize: 3, 
        };

        ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .clusterProvider(new blueprints.MngClusterProvider(mngProps))
            .resourceProvider(ampWorkspaceName, new blueprints.CreateAmpProvider(ampWorkspaceName, ampWorkspaceName))
            .version('auto')
            .withAmpProps(ampAddOnProps)
            .enableOpenSourcePatternAddOns()
            .enableControlPlaneLogging()
            .addOns(...addOns)
            .build(scope, stackId);
    }
}