import { Construct } from 'constructs';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { ObservabilityBuilder } from '../common/observability-builder';
import * as eks from 'aws-cdk-lib/aws-eks';


export default class SingleNewEksClusterAWSNativeobservabilityConstruct {
    constructor(scope: Construct, id: string) {
        // AddOns for the cluster
        const stackId = `${id}-observability-accelerator`;

        const account = process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;
        
        const addOns: Array<blueprints.ClusterAddOn> = [
            new blueprints.addons.KubeProxyAddOn(),
            new blueprints.addons.AwsLoadBalancerControllerAddOn(),
            new blueprints.addons.CertManagerAddOn({
                installCRDs:true,
                createNamespace:true,
                values:{webhook: {securePort: 10260}}
            }),
            new blueprints.addons.CloudWatchLogsAddon({
                logGroupPrefix: `/aws/eks/${stackId}`,
                logRetentionDays: 30
            }),
            new blueprints.addons.ContainerInsightsAddOn(),
       
        ];

        // Create Fargate profile, you can add selectors to match which pods to schedule on fargate, we will use 'default' i.e., all pods
        const fargateProfiles: Map<string, eks.FargateProfileOptions> = new Map([
            ["MyProfile", { selectors: [{ namespace: "myNamespace" }] }]
        ]);

        // Define fargate cluster provider and pass the profile options
        const fargateClusterProvider : blueprints.FargateClusterProvider = new blueprints.FargateClusterProvider({
            fargateProfiles,
            version: eks.KubernetesVersion.of("1.27")
        });

        
        ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .addNewClusterObservabilityBuilderAddOns("fargate")
            .clusterProvider(fargateClusterProvider)
            .addOns(...addOns)
            .build(scope, stackId);
    }
}
