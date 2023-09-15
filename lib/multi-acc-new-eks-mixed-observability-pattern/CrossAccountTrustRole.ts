import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';

/* Properties for Cross Account Trust Role: 
* roleName - new role name
* trustArn - Role ARN principal from trusted account
* actions[] - array of actions allowed in permission policy
*/
export interface CrossAccTrustRoleStackProps extends NestedStackProps {
    roleName: string, 
    trustArn: string, 
    actions: string[]
}

// Stack that creates IAM role with trust relationship to other account
export class CrossAccTrustRoleStack extends NestedStack {

    public static builder(props: CrossAccTrustRoleStackProps): blueprints.NestedStackBuilder {
        return {
            build(scope: Construct, id: string) {
                return new CrossAccTrustRoleStack(scope, id, props);
            }
        };
    }

    constructor(scope: Construct, id: string, props: CrossAccTrustRoleStackProps) {
        super(scope, id, props);

        const role = new iam.Role(this, 'cross-acc-trust-role', {
            roleName: props.roleName,
            assumedBy: new iam.ArnPrincipal(props.trustArn),
            // assumedBy: new iam.AccountPrincipal(this.account),            
            description: 'Cross Account Trust Role created as part of CDK Observability Accelerator',
        });

        role.addToPolicy(new iam.PolicyStatement({
            actions: props.actions,
            resources: ["*"],
        }));

        new cdk.CfnOutput(this, `CrossAccTrustRole-${props.roleName}`, { value: role ? role.roleArn : "none" });
    }
}