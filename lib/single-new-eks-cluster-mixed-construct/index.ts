import { Construct } from 'constructs';
import { EksBlueprint } from '@aws-quickstart/eks-blueprints';
import * as blueprints from '@aws-quickstart/eks-blueprints';

export default class SingleNewEksClusterMixedConstruct {
    constructor(scope: Construct, id: string) {
        // AddOns for the cluster
        const stackId = `${id}-observability-accelerator`;

        const account = process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;
        
        const addOns: Array<blueprints.ClusterAddOn> = [
            new blueprints.addons.AwsLoadBalancerControllerAddOn(),
            new blueprints.addons.VpcCniAddOn(),
            new blueprints.addons.CoreDnsAddOn(),
            new blueprints.addons.KubeProxyAddOn(),
            new blueprints.addons.CertManagerAddOn(),
            new blueprints.addons.ExternalsSecretsAddOn(),
            new blueprints.addons.PrometheusNodeExporterAddOn(),
            new blueprints.addons.KubeStateMetricsAddOn(),
            new blueprints.addons.AdotCollectorAddOn(),
            new blueprints.addons.CloudWatchAdotAddOn(),
            new blueprints.addons.XrayAdotAddOn(),
        ];

        EksBlueprint.builder()
            .account(account)
            .region(region)
            .addOns(...addOns)
            .build(scope, stackId);
    }
}
