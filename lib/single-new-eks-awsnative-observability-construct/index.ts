import { Construct } from 'constructs';
import { EksBlueprint } from '@aws-quickstart/eks-blueprints';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as eks from 'aws-cdk-lib/aws-eks';

export default class SingleNewEksClusterAWSNativeobservabilityConstruct {
    constructor(scope: Construct, id: string) {
        // AddOns for the cluster
        const stackId = `${id}-observability-accelerator`;

        const account = process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;

        const clusterProvider = new blueprints.GenericClusterProvider({
            version: eks.KubernetesVersion.V1_25,
            managedNodeGroups: [
                {
                    id: "mng-ondemand",
                    amiType: eks.NodegroupAmiType.AL2_X86_64,
                    instanceTypes: [new ec2.InstanceType('m5.2xlarge')],
                    launchTemplate: {
                        requireImdsv2: false
                    }
                },
            ],
        });
        
        const addOns: Array<blueprints.ClusterAddOn> = [
            new blueprints.addons.AwsLoadBalancerControllerAddOn(),
            new blueprints.addons.VpcCniAddOn(),
            new blueprints.addons.CoreDnsAddOn(),
            new blueprints.addons.KubeProxyAddOn(),
            new blueprints.addons.CertManagerAddOn(),
            new blueprints.addons.KubeStateMetricsAddOn(),
            new blueprints.addons.CloudWatchLogsAddon({
                logGroupPrefix: `/aws/eks/${stackId}`,
                logRetentionDays: 30
            }),
            new blueprints.addons.ContainerInsightsAddOn(),
        ];

        EksBlueprint.builder()
            .account(account)
            .region(region)
            .clusterProvider(clusterProvider)
            .addOns(...addOns)
            .build(scope, stackId);
    }
}
