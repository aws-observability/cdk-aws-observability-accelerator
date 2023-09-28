import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';


interface Statement {
    Effect: string;
    Action: string | string[];
    Resource: string | string[];
}

/* Properties for Cross Account Trust Role:
* roleName - new role name
* trustArn - Role ARN principal from trusted account
* policyDocument - policy statement of property Statement[]
*/
export interface CreateIAMRoleNestedStackProps extends NestedStackProps {
    roleName: string,
    trustArn: string,
    policyDocument: Statement[],
}

// Stack that creates IAM role with trust relationship to other account
export class CreateIAMRoleNestedStack extends NestedStack {

    public static builder(props: CreateIAMRoleNestedStackProps): blueprints.NestedStackBuilder {
        return {
            build(scope: Construct, id: string) {
                return new CreateIAMRoleNestedStack(scope, id, props);
            }
        };
    }

    constructor(scope: Construct, id: string, props: CreateIAMRoleNestedStackProps) {
        super(scope, id, props);

        const role = new iam.Role(this, 'coa-iam-role', {
            roleName: props.roleName,
            assumedBy: new iam.ArnPrincipal(props.trustArn),
            description: 'IAM Role created as part of CDK Observability Accelerator',
        });

        props.policyDocument.forEach((statement) => {
            role.addToPolicy(iam.PolicyStatement.fromJson(statement));
        });

        new cdk.CfnOutput(this, `COAIAMRole-${props.roleName}`, { value: role ? role.roleArn : "none" });
    }
}