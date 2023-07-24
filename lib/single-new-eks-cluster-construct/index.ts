import { Construct } from 'constructs';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { ObservabilityBuilder } from '../common/observability-builder';

export default class SingleNewEksConstruct {
    constructor(scope: Construct, id: string) {
        const stackId = `${id}-observability-accelerator`;

        const account = process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;
        
        const addOns: Array<blueprints.ClusterAddOn> = [
            new blueprints.addons.KubeProxyAddOn("auto"),
            new blueprints.addons.ClusterAutoScalerAddOn()
        ];

        ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .addNewClusterObservabilityBuilderAddOns()
            .addOns(...addOns)
            .build(scope, stackId);
    }
}
