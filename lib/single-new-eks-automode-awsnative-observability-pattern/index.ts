import { Construct } from 'constructs';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { ObservabilityBuilder } from '@aws-quickstart/eks-blueprints';
import { KubernetesVersion } from 'aws-cdk-lib/aws-eks';

export default class SingleNewEksAutoModeAWSNativeObservabilityPattern {
    constructor(scope: Construct, id: string) {

        const stackId = `${id}-observability-accelerator`;
        const account = process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;

        const cluster = new blueprints.AutomodeClusterProvider({
            version: KubernetesVersion.V1_33,
            nodePools: ['system', 'general-purpose']
        });


        ObservabilityBuilder.builder({ isAutoModeCluster: true })
            .account(account)
            .region(region)
            .clusterProvider(cluster)
            .enableNativePatternAddOns()
            .enableControlPlaneLogging()
            .build(scope, stackId);
    }
}
