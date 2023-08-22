import { Construct } from 'constructs';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { ObservabilityBuilder } from '../common/observability-builder';

export default class SingleNewEksClusterAWSNativeobservabilityPattern {
    constructor(scope: Construct, id: string) {
        // AddOns for the cluster
        const stackId = `${id}-observability-accelerator`;

        const account = process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;
        
        const addOns: Array<blueprints.ClusterAddOn> = [
            new blueprints.addons.KubeProxyAddOn(),
            new blueprints.addons.AwsLoadBalancerControllerAddOn(),
            new blueprints.addons.CertManagerAddOn(),
            new blueprints.addons.CloudWatchLogsAddon({
                logGroupPrefix: `/aws/eks/${stackId}`,
                logRetentionDays: 30
            }),
            new blueprints.addons.ContainerInsightsAddOn(),
            new blueprints.addons.XrayAddOn()
        ];

        ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .version('auto')
            .addNewClusterObservabilityBuilderAddOns()
            .addOns(...addOns)
            .build(scope, stackId);
    }
}
