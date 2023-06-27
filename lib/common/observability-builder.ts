import * as blueprints from '@aws-quickstart/eks-blueprints';
import * as utils from '@aws-quickstart/eks-blueprints/dist/utils';
import * as eks from 'aws-cdk-lib/aws-eks'
import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';



export class ObservabilityBuilder {

    public static builder(): blueprints.BlueprintBuilder {
        return new blueprints.BlueprintBuilder()
            .addOns(
                new blueprints.NestedStackAddOn({
                    id: "usage-tracking-addon",
                    builder: UsageTrackingAddOn.builder(),
                }),
                new blueprints.addons.AwsLoadBalancerControllerAddOn(),
                new blueprints.addons.VpcCniAddOn(),
                new blueprints.addons.CoreDnsAddOn(),
                new blueprints.addons.MetricsServerAddOn(),
                new blueprints.addons.ExternalsSecretsAddOn(),
                new blueprints.addons.CertManagerAddOn(),
                new blueprints.addons.PrometheusNodeExporterAddOn(),
                new blueprints.addons.KubeStateMetricsAddOn());
    }
}

/**
 * Nested stack that is used as tracker for Observability Accelerator
 */
export class UsageTrackingAddOn extends NestedStack {

    static readonly USAGE_ID = "qp-1u9l111l0";

    public static builder(): blueprints.NestedStackBuilder {
        return {
            build(scope: Construct, id: string, props: NestedStackProps) {
                return new UsageTrackingAddOn(scope, id, props);
            }
        };
    }

    constructor(scope: Construct, id: string, props: NestedStackProps) {
        super(scope, id, utils.withUsageTracking(UsageTrackingAddOn.USAGE_ID, props));
    }
}
