// import { GpuBuilder, GpuOptions } from "@aws-quickstart/eks-blueprints";
// import * as ec2 from "aws-cdk-lib/aws-ec2";
// import * as eks from "aws-cdk-lib/aws-eks";
// import { Construct } from "constructs";

// export default class SingleNewEksGpuObservabilityPattern {
//     constructor(scope: Construct, id: string) {
//         const account = process.env.CDK_DEFAULT_ACCOUNT!;
//         const region = process.env.CDK_DEFAULT_REGION!;
//         const stackID = `${id}-eks-blueprint`;

//         const options: GpuOptions = {
//             kubernetesVersion: eks.KubernetesVersion.V1_27,
//             instanceClass: ec2.InstanceClass.G4DN,
//             instanceSize: ec2.InstanceSize.XLARGE,
//             desiredNodeSize: 1,
//             minNodeSize: 1,
//             maxNodeSize: 3,
//         };

//         const values = {
//             driver: {
//                 enabled: false
//             }
//         };

//         GpuBuilder.builder(options)
//             .account(account)
//             .region(region)
//             .enableGpu(values)
//             .build(scope, stackID);
//     }
// }

import { Construct } from 'constructs';
import { utils } from '@aws-quickstart/eks-blueprints';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { GrafanaOperatorSecretAddon } from './grafanaoperatorsecretaddon';
import * as amp from 'aws-cdk-lib/aws-aps';
import { ObservabilityBuilder } from '@aws-quickstart/eks-blueprints';
import * as eks from "aws-cdk-lib/aws-eks";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as fs from 'fs';

export default class SingleNewEksGpuObservabilityPattern {
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

        const jsonString = fs.readFileSync(__dirname + '/../../cdk.json', 'utf-8');
        const jsonStringnew = JSON.parse(jsonString);
        let doc = utils.readYamlDocument(__dirname + '/../common/resources/otel-collector-config.yml');
        doc = utils.changeTextBetweenTokens(
            doc,
            "{{ if enableAPIserverJob }}",
            "{{ end }}",
            jsonStringnew.context["apiserver.pattern.enabled"]
        );
        console.log(doc);
        fs.writeFileSync(__dirname + '/../common/resources/otel-collector-config.yml', doc);

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

        if (utils.valueFromContext(scope, "apiserver.pattern.enabled", false)) {
            ampAddOnProps.enableAPIServerJob = true,
            ampAddOnProps.ampRules?.ruleFilePaths.push(
                __dirname + '/../common/resources/amp-config/apiserver/recording-rules.yml'
            );
        }

        if (utils.valueFromContext(scope, "nginx.pattern.enabled", false)) {
            ampAddOnProps.openTelemetryCollector = {
                manifestPath: __dirname + '/../common/resources/otel-collector-config.yml',
                manifestParameterMap: {
                    javaScrapeSampleLimit: 1000,
                    javaPrometheusMetricsEndpoint: "/metrics"
                }
            };
            ampAddOnProps.ampRules?.ruleFilePaths.push(
                __dirname + '/../common/resources/amp-config/nginx/alerting-rules.yml'
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
            new GrafanaOperatorSecretAddon(),
            new blueprints.addons.VpcCniAddOn(),
            new blueprints.addons.GpuOperatorAddon({
                values: {
                    driver: {
                        enabled: false
                    }
                }
            })
        ];

        ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .version('auto')
            .enableOpenSourcePatternAddOns(ampAddOnProps)
            .resourceProvider(ampWorkspaceName, new blueprints.CreateAmpProvider(ampWorkspaceName, ampWorkspaceName))
            .clusterProvider(
                new blueprints.GenericClusterProvider({
                    version: eks.KubernetesVersion.V1_27,
                    tags: {
                        "Name": "blueprints-gpu-eks-cluster",
                        "Type": "generic-gpu-cluster"
                    },
                    managedNodeGroups: [
                        addGpuNodeGroup(),
                    ]
                })
            )
            .addOns(...addOns)
            .build(scope, stackId);
    }
}

function addGpuNodeGroup(): blueprints.ManagedNodeGroup {

    return {
        id: "mng-linux-gpu-01",
        amiType: eks.NodegroupAmiType.AL2_X86_64_GPU,
        instanceTypes: [new ec2.InstanceType(`${ec2.InstanceClass.G4DN}.${ec2.InstanceSize.XLARGE}`)],
        desiredSize: 2, 
        minSize: 2, 
        maxSize:3,
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
                    volume: ec2.BlockDeviceVolume.ebs(50),
                }
            ]
        }
    };
}
