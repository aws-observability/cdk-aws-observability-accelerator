import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { Construct } from 'constructs';
import { PolicyStatement, Effect, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';


/**
 * Defines properties for the AMG IAM setup. 
 */
export interface AmgIamSetupStackProps extends NestedStackProps {
    /**
     * Role to create for the AMG stack that grants access to the specified accounts for AMP and CloudWatch metrics.
     */
    roleName: string,

    /**
     * Monitored accounts. These contain ampPrometheusDataSourceRole and cloudwatchPrometheusDataSourceRole roles 
     * with trust relationship to the monitoring (AMG) account.
     */
    accounts: string[]
} 

/**
 * Stack provisions IAM in the moniitoring account with turst relationship to the monitored account for metrics. 
 */
export class AmgIamSetupStack extends NestedStack {

    constructor(scope: Construct, id: string, props: AmgIamSetupStackProps) {
        super(scope, id, props);

        const account = this.account;
        const region = this.region;

        // Create role
        const workspaceRole = new Role(this, 'WorkspaceRole', {
            roleName: props.roleName,
            assumedBy: new ServicePrincipal('grafana.amazonaws.com').withConditions({
                StringEquals: {'aws:SourceAccount': `${account}`},
                StringLike: {'aws:SourceArn': `arn:aws:grafana:${region}:${account}:workspaces/*`}
            }),
            description: 'Service Role for Amazon Managed Grafana'
        });

        // const workspaceRole = new Role(this, 'amg-iam-role', {
        //     roleName: props.roleName,
        //     assumedBy: new ServicePrincipal('grafana.amazonaws.com'),
        //     description: 'Service Role for Amazon Managed Grafana',
        // });        

        // Inline policy for Amazon Managed Prometheus
        const AMGPrometheusPolicy = new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                "aps:ListWorkspaces",
                "aps:DescribeWorkspace",
                "aps:QueryMetrics",
                "aps:GetLabels",
                "aps:GetSeries",
                "aps:GetMetricMetadata"
            ],
            resources: ['*']
        });
  
        // workspaceRole.addToPolicy(AMGPrometheusPolicy);

        // Inline policy for SNS
        const AMGSNSPolicy = new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                "sns:Publish"
            ],
            resources: [`arn:aws:sns:*:${account}:grafana*`]
        });
  
        // workspaceRole.addToPolicy(AMGSNSPolicy);                

        
        for (let i = 0; i < props.accounts.length; i++) {
            workspaceRole.addToPolicy(new PolicyStatement({
                actions: [
                    "sts:AssumeRole"
                ],
                resources: [`arn:aws:iam::${props.accounts[i]}:role/ampPrometheusDataSourceRole`,
                    `arn:aws:iam::${props.accounts[i]}:role/cloudwatchDataSourceRole`
                ],
            }));
        }

        new cdk.CfnOutput(this, 'AMGRole', { value: workspaceRole ? workspaceRole.roleArn : "none" });
    }

    public static builder(props: AmgIamSetupStackProps): blueprints.NestedStackBuilder {
        return {
            build(scope: Construct, id: string) {
                return new AmgIamSetupStack(scope, id, props);
            }
        };
    }

}