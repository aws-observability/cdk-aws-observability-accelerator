import { Construct } from 'constructs';
import * as cdk from "aws-cdk-lib";
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { GlobalResources, LookupHostedZoneProvider, ObservabilityBuilder } from '@aws-quickstart/eks-blueprints';
import { KubecostServiceAccountsAddon } from './kubecostserviceaccountsaddon';
import { KubecostAddOn, KubecostAddOnProps } from '@kubecost/kubecost-eks-blueprints-addon';
import * as amp from 'aws-cdk-lib/aws-aps';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { setPath } from '@aws-quickstart/eks-blueprints/dist/utils';
import CognitoIdpStack from '../common/cognito/cognito-idp-stack';
import * as fs from 'fs';

const gitUrl = 'https://github.com/aws-samples/eks-blueprints-workloads.git';

export default class SingleNewEksCostMonitoringPattern extends cdk.Stack {
    async buildAsync(scope: Construct, id: string) {

        const subdomain: string = blueprints.utils.valueFromContext(scope, "dev.subzone.name", "dev.mycompany.a2z.com");
        const parentDomain = blueprints.utils.valueFromContext(scope, "parent.hostedzone.name", "mycompany.a2z.com");
        const certificate: ICertificate = blueprints.getNamedResource(GlobalResources.Certificate);

        const cognitoIdpStackOut = new CognitoIdpStack (scope,'cognito-idp-stack', subdomain,
            {
                env: {
                    account: process.env.CDK_DEFAULT_ACCOUNT,
                    region: process.env.CDK_DEFAULT_REGION,
                },
            });


        const stackId = `${id}-observability-accelerator`;
        const account = process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;

        const ampWorkspaceName = process.env.COA_AMP_WORKSPACE_NAME! || 'observability-amp-workspace';
        const ampWorkspace = blueprints.getNamedResource(ampWorkspaceName) as unknown as amp.CfnWorkspace;
        const ampEndpoint = ampWorkspace.attrPrometheusEndpoint;
        const ampWorkspaceArn = ampWorkspace.attrArn;

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

        let doc = blueprints.utils.readYamlDocument(__dirname + '/../common/resources/otel-collector-config.yml');
        doc = blueprints.utils.changeTextBetweenTokens(
            doc,
            "{{ start kubecostJob }}",
            "{{ stop kubecostJob }}",
            true
        );
        doc = blueprints.utils.changeTextBetweenTokens(
            doc,
            "{{ start enableJavaMonJob }}",
            "{{ stop enableJavaMonJob }}",
            false
        );
        doc = blueprints.utils.changeTextBetweenTokens(
            doc,
            "{{ start enableNginxMonJob }}",
            "{{ stop enableNginxMonJob }}",
            false
        );
        doc = blueprints.utils.changeTextBetweenTokens(
            doc,
            "{{ start enableIstioMonJob }}",
            "{{ stop enableIstioMonJob }}",
            false
        );
        doc = blueprints.utils.changeTextBetweenTokens(
            doc,
            "{{ start enableAPIserverJob }}",
            "{{ stop enableAPIserverJob }}",
            false
        );
        doc = blueprints.utils.changeTextBetweenTokens(
            doc,
            "{{ start enableAdotMetricsCollectionJob }}",
            "{{ stop enableAdotMetricsCollectionJob }}",
            false
        );
        doc = blueprints.utils.changeTextBetweenTokens(
            doc,
            "{{ start enableAdotMetricsCollectionTelemetry }}",
            "{{ stop enableAdotMetricsCollectionTelemetry }}",
            true
        );

        doc = blueprints.utils.changeTextBetweenTokens(
            doc,
            "{{ start enableAdotContainerLogsReceiver }}",
            "{{ stop enableAdotContainerLogsReceiver }}",
            true
        );
        doc = blueprints.utils.changeTextBetweenTokens(
            doc,
            "{{ start enableAdotContainerLogsExporter }}",
            "{{ stop enableAdotContainerLogsExporter }}",
            true
        );

        fs.writeFileSync(__dirname + '/../common/resources/otel-collector-config-new.yml', doc);

        ampAddOnProps.openTelemetryCollector = {
            manifestPath: __dirname + '/../common/resources/otel-collector-config-new.yml',
            manifestParameterMap: {
                subdomain: subdomain,
                logGroupName: `/aws/eks/costmonitoring/${ampWorkspaceName}`,
                logStreamName: `$NODE_NAME`,
                logRetentionDays: 30,
                awsRegion: region 
            }
        };

        const addOns: Array<blueprints.ClusterAddOn> = [
            new blueprints.addons.CloudWatchLogsAddon({
                logGroupPrefix: `/aws/eks/${stackId}`,
                logRetentionDays: 30
            }),
            new blueprints.addons.AwsLoadBalancerControllerAddOn(),
            new blueprints.addons.CertManagerAddOn(),
            new blueprints.addons.AdotCollectorAddOn(),
            new blueprints.addons.CoreDnsAddOn(),
            new blueprints.addons.ExternalDnsAddOn({
                hostedZoneResources: [GlobalResources.HostedZone]
            }),
            new blueprints.addons.ExternalsSecretsAddOn(),
            new blueprints.addons.KubeProxyAddOn(),
            new blueprints.addons.KubeStateMetricsAddOn(),
            new blueprints.addons.MetricsServerAddOn(),
            new blueprints.addons.EbsCsiDriverAddOn(),
            new blueprints.addons.AmpAddOn(ampAddOnProps),
            new blueprints.addons.PrometheusNodeExporterAddOn(),
            new blueprints.SecretsStoreAddOn({ rotationPollInterval: "120s" }),
            new blueprints.SSMAgentAddOn(),
            new KubeCostExtensionAddon({
                namespace:"kubecost",
                version:"1.108.1",
                values: {
                    global: {
                        amp: {
                            prometheusServerEndpoint: ampWorkspace.attrWorkspaceId,
                            enabled: true,
                            sigv4: {
                                region: region
                            }
                        },
                        grafana: {
                            enabled: false,
                            proxy: false
                        }
                    },
                    kubecostProductConfigs: {
                        clusterName: stackId,
                        projectID: account
                    },
                    prometheus: {
                        nodeExporter: {
                            enabled: false
                        },
                        serviceAccounts:{
                            nodeExporter:{
                                create: false
                            }
                        },
                        server: {
                            global: {
                                external_labels: {
                                    cluster_id: stackId
                                }
                            }
                        }
                    },
                    serviceAccount:{
                        name: "kubecost-cost-analyzer-amp",
                        create: false,
                        server: {
                            create: false,
                            name: "kubecost-prometheus-server-amp"
                        }
                    }
                }                

            }),
            new blueprints.ArgoCDAddOn({
                bootstrapRepo: {
                    repoUrl: gitUrl,
                    targetRevision: "main",
                    path: 'secure-ingress-cognito/envs/dev'
                },
                bootstrapValues: {
                    spec: {
                        ingress: {
                            host: subdomain,
                            cognitoUserPoolArn: cognitoIdpStackOut.userPoolOut.userPoolArn,
                            cognitoUserPoolAppId: cognitoIdpStackOut.userPoolClientOut.userPoolClientId,
                            cognitoDomainName: cognitoIdpStackOut.userPoolDomainOut.domainName,
                            certificateArn: certificate.certificateArn,
                            region: process.env.CDK_DEFAULT_REGION,
                        }
                    },
                }
            }),
            new KubecostServiceAccountsAddon()
        ];

        const mngProps: blueprints.MngClusterProviderProps = {
            version: eks.KubernetesVersion.of("1.28"),
            instanceTypes: [new ec2.InstanceType("m5.2xlarge")],
            amiType: eks.NodegroupAmiType.AL2_X86_64,
            desiredSize: 2,
            maxSize: 3, 
        };

        await ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .clusterProvider(new blueprints.MngClusterProvider(mngProps))
            .version('auto')
            .resourceProvider(GlobalResources.HostedZone, new LookupHostedZoneProvider(parentDomain))
            .resourceProvider(GlobalResources.Certificate, new blueprints.CreateCertificateProvider('secure-ingress-cert', `${subdomain}`, GlobalResources.HostedZone))
            .resourceProvider(ampWorkspaceName, new blueprints.CreateAmpProvider(ampWorkspaceName, ampWorkspaceName))
            .addOns(...addOns)
            .buildAsync(scope, stackId);
    }
}

class KubeCostExtensionAddon extends KubecostAddOn {
    constructor(props?: KubecostAddOnProps) {
        super(props);
    }

    deploy(clusterInfo: blueprints.ClusterInfo): Promise<Construct> {
        const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;
        const ampWorkspaceId = this.options.values!.global.amp.prometheusServerEndpoint;
        const prometheusServerEndpoint = 'http://localhost:8005/workspaces/' + ampWorkspaceId;
        const remoteWriteEndpoint = `https://aps-workspaces.${region}.amazonaws.com/workspaces/${ampWorkspaceId}/api/v1/remote_write`;
        const sigV4ProxyHost = `aps-workspaces.${region}.amazonaws.com`;
        setPath(this.options!.values, "global.amp.prometheusServerEndpoint", prometheusServerEndpoint);
        setPath(this.options!.values, "global.amp.remoteWriteService", remoteWriteEndpoint);
        setPath(this.options!.values, "global.amp.sigv4.region", region);
        setPath(this.options!.values, "global.prometheus.fqdn", remoteWriteEndpoint);
        setPath(this.options!.values, "sigV4Proxy.region", region);
        setPath(this.options!.values, "sigV4Proxy.host", sigV4ProxyHost);
        return super.deploy(clusterInfo);
    } 
}