import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { Construct } from 'constructs';
import * as utils from '@aws-quickstart/eks-blueprints/dist/utils';

/**
 * Nested stack that is used as tracker for Observability Accelerator
 */
export class TrackerStack extends NestedStack {

    static readonly USAGE_ID = "qp-1u9l111l0";

    public static builder(): blueprints.NestedStackBuilder {
        return {
            build(scope: Construct, id: string, props: NestedStackProps) {
                return new TrackerStack(scope, id, props);
            }
        };
    }

    constructor(scope: Construct, id: string, props: NestedStackProps) {
        super(scope, id, utils.withUsageTracking(TrackerStack.USAGE_ID, props));
    }
}