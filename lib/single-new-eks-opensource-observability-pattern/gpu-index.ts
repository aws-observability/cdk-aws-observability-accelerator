import { Construct } from 'constructs';
import { utils } from '@aws-quickstart/eks-blueprints';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { GrafanaOperatorSecretAddon } from './grafanaoperatorsecretaddon';
import * as amp from 'aws-cdk-lib/aws-aps';
import { ObservabilityBuilder } from '@aws-quickstart/eks-blueprints';
import * as eks from "aws-cdk-lib/aws-eks";
import * as ec2 from "aws-cdk-lib/aws-ec2";

interface GpuNodeGroupProps {
    instanceType: string,
    desiredSize: number, 
    minSize: number, 
    maxSize:number,
    ebsSize: number
}

export default class SingleNewEksGpuOpenSourceObservabilityPattern {
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

        const gpuNodeGroup: GpuNodeGroupProps = utils.valueFromContext(scope, "gpuNodeGroup", undefined);
        if (gpuNodeGroup === undefined) {
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
            new blueprints.addons.GpuOperatorAddon({
                version: "v23.6.1",
                values: {
                    driver: {
                        enabled: false // the GPU driver is already embedded into the AL2_X86_64_GPU AMI image 
                    }
                }
            })
        ];

        ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .version('auto')
            .withAmpProps(ampAddOnProps)
            .enableOpenSourcePatternAddOns()
            .enableControlPlaneLogging()
            .resourceProvider(ampWorkspaceName, new blueprints.CreateAmpProvider(ampWorkspaceName, ampWorkspaceName))
            .clusterProvider(
                new blueprints.GenericClusterProvider({
                    tags: {
                        "Name": "blueprints-gpu-eks-cluster",
                        "Type": "generic-gpu-cluster"
                    },
                    managedNodeGroups: [
                        addGpuNodeGroup(gpuNodeGroup),
                    ]
                })
            )
            .addOns(...addOns)
            .build(scope, stackId);
    }
}

function addGpuNodeGroup(gpuNodeGroupProps: GpuNodeGroupProps): blueprints.ManagedNodeGroup {
    return {
        id: "mng-linux-gpu-01",
        amiType: eks.NodegroupAmiType.AL2_X86_64_GPU,
        instanceTypes: [new ec2.InstanceType(gpuNodeGroupProps.instanceType)],
        desiredSize: gpuNodeGroupProps.desiredSize, 
        minSize: gpuNodeGroupProps.minSize, 
        maxSize: gpuNodeGroupProps.maxSize,
        nodeGroupSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        launchTemplate: {
            tags: {
                "Name": "Mng-linux-Gpu",
                "Type": "Managed-linux-Gpu-Node-Group",
                "LaunchTemplate": "Linux-Launch-Template",
            },
            requireImdsv2: false,
            blockDevices: [
                {
                    deviceName: "/dev/sda1",
                    volume: ec2.BlockDeviceVolume.ebs(gpuNodeGroupProps.ebsSize),
                }
            ]
        }
    };
}
