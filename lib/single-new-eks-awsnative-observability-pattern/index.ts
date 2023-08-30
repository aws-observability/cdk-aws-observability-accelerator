import { Construct } from 'constructs';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { ObservabilityBuilder } from '@aws-quickstart/eks-blueprints';

export default class SingleNewEksClusterAWSNativeobservabilityPattern {
    constructor(scope: Construct, id: string) {
        
        const stackId = `${id}-observability-accelerator`;
        const account = process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;
        
        const addOns: Array<blueprints.ClusterAddOn> = [
            new blueprints.addons.CloudWatchLogsAddon({
                logGroupPrefix: `/aws/eks/${stackId}`,
                logRetentionDays: 30
            }),
            new blueprints.addons.XrayAddOn()
        ];

        ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .version('auto')
            .enableNativePatternAddOns()
            .addOns(...addOns)
            .build(scope, stackId);
    }
}
