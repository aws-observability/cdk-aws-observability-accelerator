// import { Construct } from 'constructs';
import { ImportClusterProvider, utils } from '@aws-quickstart/eks-blueprints';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { GrafanaOperatorSecretAddon } from './grafanaoperatorsecretaddon';
import * as amp from 'aws-cdk-lib/aws-aps';
import { ObservabilityBuilder } from '@aws-quickstart/eks-blueprints';
import * as cdk from "aws-cdk-lib";
import * as eks from 'aws-cdk-lib/aws-eks';
import * as fs from 'fs';
import { IstioIngressGatewayHelmAddon } from '../single-new-eks-opensource-observability-pattern/istio/istioIngressGatewayAddon';
import { IstioCniHelmAddon } from '../single-new-eks-opensource-observability-pattern/istio/istiocniAddon';

export default class ExistingEksOpenSourceobservabilityPattern {
    async buildAsync(scope: cdk.App, id: string) {

        const stackId = `${id}-observability-accelerator`;
        const clusterName = utils.valueFromContext(scope, "existing.cluster.name", undefined);
        const kubectlRoleName = utils.valueFromContext(scope, "existing.kubectl.rolename", undefined);

        const account = process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;
        const ampWorkspaceName = process.env.COA_AMP_WORKSPACE_NAME! || 'observability-amp-Workspace';
        const ampWorkspace = blueprints.getNamedResource(ampWorkspaceName) as unknown as amp.CfnWorkspace;
        const ampEndpoint = ampWorkspace.attrPrometheusEndpoint;
        const ampWorkspaceArn = ampWorkspace.attrArn;
        const amgEndpointUrl = process.env.COA_AMG_ENDPOINT_URL;
        const sdkCluster = await blueprints.describeCluster(clusterName, region); // get cluster information using EKS APIs
        const vpcId = sdkCluster.resourcesVpcConfig?.vpcId;

        /**
         * Assumes the supplied role is registered in the target cluster for kubectl access.
         */

        const importClusterProvider = new ImportClusterProvider({
            clusterName: sdkCluster.name!,
            version: eks.KubernetesVersion.of(sdkCluster.version!),
            clusterEndpoint: sdkCluster.endpoint,
            openIdConnectProvider: blueprints.getResource(context =>
                new blueprints.LookupOpenIdConnectProvider(sdkCluster.identity!.oidc!.issuer!).provide(context)),
            clusterCertificateAuthorityData: sdkCluster.certificateAuthority?.data,
            kubectlRoleArn: blueprints.getResource(context => new blueprints.LookupRoleProvider(kubectlRoleName).provide(context)).roleArn,
            clusterSecurityGroupId: sdkCluster.resourcesVpcConfig?.clusterSecurityGroupId
        });

        // All Grafana Dashboard URLs from `cdk.json` if presentgi
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

        if (utils.valueFromContext(scope, "adotcollectormetrics.pattern.enabled", false)) {
            ampAddOnProps.openTelemetryCollector = {
                manifestPath: __dirname + '/../common/resources/otel-collector-config-new.yml'
            };
        }

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
                manifestPath: __dirname + '/../common/resources/otel-collector-config-new.yml',
                manifestParameterMap: {
                    nginxScrapeSampleLimit: 1000,
                    nginxPrometheusMetricsEndpoint: "/metrics"
                }
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
            new blueprints.addons.FluxCDAddOn({ "repositories": [fluxRepository] }),
            new GrafanaOperatorSecretAddon(),
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

        ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .version('auto')
            .withAmpProps(ampAddOnProps)
            .enableOpenSourcePatternAddOns()
            .clusterProvider(importClusterProvider)
            .resourceProvider(blueprints.GlobalResources.Vpc, new blueprints.VpcProvider(vpcId)) // this is required with import cluster provider
            .resourceProvider(ampWorkspaceName, new blueprints.CreateAmpProvider(ampWorkspaceName, ampWorkspaceName))
            .addOns(...addOns)
            .build(scope, stackId);
    }
}
