import * as blueprints from '@aws-quickstart/eks-blueprints';
import * as utils from '@aws-quickstart/eks-blueprints/dist/utils';
import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

type ComputeType = "ec2" | "fargate";

export class ObservabilityBuilder extends blueprints.BlueprintBuilder {

    public addNewClusterObservabilityBuilderAddOns(computeType: ComputeType = "ec2"): ObservabilityBuilder {
        return this.addOns(
            new blueprints.addons.VpcCniAddOn(),
            new blueprints.addons.CoreDnsAddOn({
                version:"v1.9.3-eksbuild.5",
                configurationValues:{ computeType: computeType }
            }),
            new blueprints.addons.MetricsServerAddOn(),
            new blueprints.addons.PrometheusNodeExporterAddOn(),
            new blueprints.addons.KubeStateMetricsAddOn());
    }

    public addExistingClusterObservabilityBuilderAddOns(): ObservabilityBuilder {
        return this.addOns(
            new blueprints.addons.AwsLoadBalancerControllerAddOn(),
            new blueprints.addons.CertManagerAddOn());
    }

    public static builder(): ObservabilityBuilder {
        const builder = new ObservabilityBuilder();
        builder.addOns(
            new blueprints.NestedStackAddOn({
                id: "usage-tracking-addon",
                builder: UsageTrackingAddOn.builder(),
            }));
        return builder;
    }
}

/**
 * Nested stack that is used as tracker for Observability Accelerator
 */
export class UsageTrackingAddOn extends NestedStack {

    static readonly USAGE_ID = "qs-1u9l12gj7";

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
