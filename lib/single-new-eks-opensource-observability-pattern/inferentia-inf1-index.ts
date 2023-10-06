import { Construct } from 'constructs';
import { utils } from '@aws-quickstart/eks-blueprints';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { GrafanaOperatorSecretAddon } from './grafanaoperatorsecretaddon';
import * as amp from 'aws-cdk-lib/aws-aps';
import { ObservabilityBuilder } from '@aws-quickstart/eks-blueprints';
import * as eks from "aws-cdk-lib/aws-eks";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { NeuronDevicePluginAddOn } from './neuron-addon';

interface Inf1NodeGroupProps {
    instanceSize: "xlarge" | "2xlarge" | "6xlarge" | "24xlarge",
    desiredSize: number, 
    minSize: number, 
    maxSize:number,
    ebsSize: number
}

export default class SingleNewEksInf1OpenSourceObservabilityPattern {
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

        const inf1NodeGroup: Inf1NodeGroupProps = utils.valueFromContext(scope, "inf1NodeGroup", undefined);
        if (inf1NodeGroup === undefined) {
            throw new Error("Missing node group configuration");
        }

        Reflect.defineMetadata("ordered", true, blueprints.addons.GrafanaOperatorAddon);
        const addOns: Array<blueprints.ClusterAddOn> = [
            new blueprints.addons.CloudWatchLogsAddon({
                logGroupPrefix: `/aws/eks/${stackId}`,
                logRetentionDays: 30
            }),
            new blueprints.addons.XrayAdotAddOn(),
            new blueprints.addons.FluxCDAddOn({"repositories": [fluxRepository]}),
            new GrafanaOperatorSecretAddon(),
            new blueprints.addons.VpcCniAddOn(),
            new NeuronDevicePluginAddOn()
        ];

        ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .version('auto')
            .enableOpenSourcePatternAddOns(ampAddOnProps)
            .resourceProvider(ampWorkspaceName, new blueprints.CreateAmpProvider(ampWorkspaceName, ampWorkspaceName))
            .clusterProvider(
                new blueprints.GenericClusterProvider({
                    tags: {
                        "Name": "blueprints-gpu-eks-cluster",
                        "Type": "generic-gpu-cluster"
                    },
                    managedNodeGroups: [
                        addInf1NodeGroup(inf1NodeGroup),
                    ]
                })
            )
            .addOns(...addOns)
            .build(scope, stackId);
    }
}

function addInf1NodeGroup(inf1NodeGroupProps: Inf1NodeGroupProps): blueprints.ManagedNodeGroup {
    return {
        id: "mng-linux-inf1-01",
        amiType: eks.NodegroupAmiType.AL2_X86_64_GPU,
        instanceTypes: [new ec2.InstanceType(`inf1.${inf1NodeGroupProps.instanceSize}`)],
        desiredSize: inf1NodeGroupProps.desiredSize, 
        minSize: inf1NodeGroupProps.minSize, 
        maxSize: inf1NodeGroupProps.maxSize,
        nodeGroupSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        launchTemplate: {
            tags: {
                "Name": "Mng-linux-Inf1",
                "Type": "Managed-linux-Inf1-Node-Group",
                "LaunchTemplate": "Linux-Launch-Template",
            },
            blockDevices: [
                {
                    deviceName: "/dev/xvda",
                    volume: ec2.BlockDeviceVolume.ebs(inf1NodeGroupProps.ebsSize, {
                        volumeType: ec2.EbsDeviceVolumeType.GP3
                    })
                }
            ]
        }
    };
}
