import { Construct } from 'constructs';
import { utils } from '@aws-quickstart/eks-blueprints';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { GrafanaOperatorSecretAddon } from './grafanaoperatorsecretaddon';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as amp from 'aws-cdk-lib/aws-aps';
import { ObservabilityBuilder } from '@aws-quickstart/eks-blueprints';
import * as fs from 'fs';

export default class SingleNewEksKubeflowbservabilityPattern {
    constructor(scope: Construct, id: string) {
        
        const stackId = `${id}-observability-accelerator`;

        const account = process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;
        const ampWorkspaceName = process.env.COA_AMP_WORKSPACE_NAME! || 'observability-amp-Workspace';
        const ampWorkspace = blueprints.getNamedResource(ampWorkspaceName) as unknown as amp.CfnWorkspace;
        const ampEndpoint = ampWorkspace.attrPrometheusEndpoint;
        const ampWorkspaceArn = ampWorkspace.attrArn;
        
        const amgEndpointUrl = process.env.COA_AMG_ENDPOINT_URL;

        // All Grafana Dashboard URLs from `cdk.json`
        const fluxRepository: blueprints.FluxGitRepo = utils.valueFromContext(scope, "fluxRepository", undefined);
        fluxRepository.values!.AMG_AWS_REGION = region;
        fluxRepository.values!.AMP_ENDPOINT_URL = ampEndpoint;
        fluxRepository.values!.AMG_ENDPOINT_URL = amgEndpointUrl;

        const fluxIstioRepository: blueprints.FluxGitRepo = utils.valueFromContext(scope, "fluxIstioRepository", undefined);
        fluxIstioRepository.values!.AMG_AWS_REGION = region;
        fluxIstioRepository.values!.AMP_ENDPOINT_URL = ampEndpoint;
        fluxIstioRepository.values!.AMG_ENDPOINT_URL = amgEndpointUrl;

        const ampAddOnProps: blueprints.AmpAddOnProps = {
            ampPrometheusEndpoint: ampEndpoint,
            deploymentMode: blueprints.DeploymentMode.DAEMONSET,
            ampRules: {
                ampWorkspaceArn: ampWorkspaceArn,
                ruleFilePaths: [
                    __dirname + '/../common/resources/amp-config/alerting-rules.yml',
                    __dirname + '/../common/resources/amp-config/recording-rules.yml'
                ]
            }
        };

        let doc = utils.readYamlDocument(__dirname + '/../common/resources/otel-collector-config.yml');

        doc = utils.changeTextBetweenTokens(
            doc,
            "{{ start enableJavaMonJob }}",
            "{{ stop enableJavaMonJob }}",
            false
        );
        doc = utils.changeTextBetweenTokens(
            doc,
            "{{ start enableNginxMonJob }}",
            "{{ stop enableNginxMonJob }}",
            false
        );
        doc = utils.changeTextBetweenTokens(
            doc,
            "{{ start enableAdotMetricsCollectionJob }}",
            "{{ stop enableAdotMetricsCollectionJob }}",
            false
        );
        doc = utils.changeTextBetweenTokens(
            doc,
            "{{ start enableAdotMetricsCollectionTelemetry }}",
            "{{ stop enableAdotMetricsCollectionTelemetry }}",
            false
        );

        doc = utils.changeTextBetweenTokens(
            doc,
            "{{ start enableIstioMonJob }}",
            "{{ stop enableIstioMonJob }}",
            true
        );
        doc = utils.changeTextBetweenTokens(
            doc,
            "{{ start enableAPIserverJob }}",
            "{{ stop enableAPIserverJob }}",
            true
        );
        doc = utils.changeTextBetweenTokens(
            doc,
            "{{ start enableAdotContainerLogsReceiver }}",
            "{{ stop enableAdotContainerLogsReceiver }}",
            true
        );
        doc = utils.changeTextBetweenTokens(
            doc,
            "{{ start enableAdotContainerLogsExporter }}",
            "{{ stop enableAdotContainerLogsExporter }}",
            true
        );
        console.log(doc);
        fs.writeFileSync(__dirname + '/../common/resources/otel-collector-config-new.yml', doc);

        if (utils.valueFromContext(scope, "apiserver.pattern.enabled", false)) {
            ampAddOnProps.enableAPIServerJob = true,
            ampAddOnProps.ampRules?.ruleFilePaths.push(
                __dirname + '/../common/resources/amp-config/apiserver/recording-rules.yml'
            );
        }

        ampAddOnProps.openTelemetryCollector = {
            manifestPath: __dirname + '/../common/resources/otel-collector-config-new.yml',
            manifestParameterMap: {
                logGroupName: `/aws/eks/${stackId}`,
                logStreamName: `$NODE_NAME`,
                logRetentionDays: 30,
                awsRegion: region 
            }
        };

        ampAddOnProps.ampRules?.ruleFilePaths.push(
            __dirname + '/../common/resources/amp-config/istio/alerting-rules.yml',
            __dirname + '/../common/resources/amp-config/istio/recording-rules.yml'
        );

        Reflect.defineMetadata("ordered", true, blueprints.addons.GrafanaOperatorAddon);
        const addOns: Array<blueprints.ClusterAddOn> = [
            new blueprints.VpcCniAddOn(),
            new blueprints.EbsCsiDriverAddOn(),
            new blueprints.addons.XrayAdotAddOn(),
            new blueprints.addons.FluxCDAddOn({"repositories": [fluxRepository, fluxIstioRepository]}),
            new GrafanaOperatorSecretAddon(),
            new blueprints.ArgoCDAddOn(
                {
                    bootstrapRepo: {
                        repoUrl: 'https://github.com/arunvthangaraj/eks-blueprints-workloads.git',
                        targetRevision: 'main',
                        path: 'kubeflow-monitoring/envs/prod',
                    }
                }
            )
            //new KubeflowAddOn()
        ];

        const mngProps: blueprints.MngClusterProviderProps = {
            version: eks.KubernetesVersion.V1_29,
            instanceTypes: [new ec2.InstanceType("m5.2xlarge")],
            amiType: eks.NodegroupAmiType.AL2_X86_64,
            desiredSize: 5,
            maxSize: 10, 
        };

        ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .clusterProvider(new blueprints.MngClusterProvider(mngProps))
            .resourceProvider(ampWorkspaceName, new blueprints.CreateAmpProvider(ampWorkspaceName, ampWorkspaceName))
            .version('auto')
            .withAmpProps(ampAddOnProps)
            .enableControlPlaneLogging()
            .enableOpenSourcePatternAddOns()
            .addOns(...addOns)
            .build(scope, stackId);
    }
}