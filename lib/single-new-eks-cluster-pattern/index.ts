import { Construct } from 'constructs';
import * as eks from "aws-cdk-lib/aws-eks";
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { ObservabilityBuilder } from '@aws-quickstart/eks-blueprints';

export default class SingleNewEksPattern {
    constructor(scope: Construct, id: string) {
        const stackId = `${id}-observability-accelerator`;

        const account = process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;
        
        const addOns: Array<blueprints.ClusterAddOn> = [
            new blueprints.addons.ClusterAutoScalerAddOn(),
            new blueprints.addons.AwsLoadBalancerControllerAddOn()
        ];

        ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .version(eks.KubernetesVersion.V1_26)
            .addOns(...addOns)
            .build(scope, stackId);
    }
}
