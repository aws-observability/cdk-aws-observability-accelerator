import { Construct } from 'constructs';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { ObservabilityBuilder } from '@aws-quickstart/eks-blueprints';
import { GrafanaOperatorSecretAddon } from './grafanaoperatorsecretaddon';
import { KubecostAddOn } from '@kubecost/kubecost-eks-blueprints-addon';
import * as amp from 'aws-cdk-lib/aws-aps';

export default class SingleNewEksCostMonitoringPattern {
    constructor(scope: Construct, id: string) {

        const stackId = `${id}-observability-accelerator`;
        const account = process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;

        const ampWorkspaceName = process.env.COA_AMP_WORKSPACE_NAME! || 'observability-amp-workspace';
        const ampWorkspace = blueprints.getNamedResource(ampWorkspaceName) as unknown as amp.CfnWorkspace;
        const ampEndpoint = ampWorkspace.attrPrometheusEndpoint;
        const ampWorkspaceArn = ampWorkspace.attrArn;

        const queryUrl = `https://aps-workspaces.us-west-2.amazonaws.com/workspaces/ws-bd2b2b87-6484-4349-8753-fa46557e6031/api/v1/query`;

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

        Reflect.defineMetadata("ordered", true, blueprints.addons.GrafanaOperatorAddon);
        const addOns: Array<blueprints.ClusterAddOn> = [
            new blueprints.addons.CloudWatchLogsAddon({
                logGroupPrefix: `/aws/eks/${stackId}`,
                logRetentionDays: 30
            }),
            new blueprints.addons.EbsCsiDriverAddOn(),
            new blueprints.addons.ExternalsSecretsAddOn(),
            new blueprints.SecretsStoreAddOn({ rotationPollInterval: "120s" }),
            new blueprints.SSMAgentAddOn(),
            new KubecostAddOn({
                namespace:"kubecost",
                values: {
                    global: {
                        amp: {
                            enabled: true,
                            prometheusServerEndpoint: queryUrl,
                            remoteWriteService: ampEndpoint,
                            sigv4: {
                                region: region
                            }
                        }
                    },
                    kubecostProductConfigs: {
                        clusterName: stackId,
                        projectID: account
                    },
                    prometheus: {
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
                    },
                    federatedETL:{
                        federator: {
                            useMultiClusterDB : true
                        }
                    }
                }                

            }),
            new blueprints.addons.GrafanaOperatorAddon({
                createNamespace: true,
            }),
            new GrafanaOperatorSecretAddon()
        ];

        ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .version('auto')
            .withAmpProps(ampAddOnProps)
            .resourceProvider(ampWorkspaceName, new blueprints.CreateAmpProvider(ampWorkspaceName, ampWorkspaceName))
            .enableNativePatternAddOns()
            .addOns(...addOns)
            .build(scope, stackId);
    }
}