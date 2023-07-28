// import { Construct } from 'constructs';
import { ImportClusterProvider, utils } from '@aws-quickstart/eks-blueprints';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { ObservabilityBuilder } from '../common/observability-builder';
import * as cdk from "aws-cdk-lib";
import * as eks from 'aws-cdk-lib/aws-eks';

export default class ExistingEksAwsNativeObservabilityConstruct {
    async buildAsync(scope: cdk.App, id: string) {
        // AddOns for the cluster
        const stackId = `${id}-observability-accelerator`;
        const clusterName = utils.valueFromContext(scope, "existing.cluster.name", undefined);
        const kubectlRoleName = utils.valueFromContext(scope, "existing.kubectl.rolename", undefined);

        const account = process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;
        
        const sdkCluster = await blueprints.describeCluster(clusterName, region); // get cluster information using EKS APIs
        const vpcId = sdkCluster.resourcesVpcConfig?.vpcId;

        /*
         * Assumes the supplied role is registered in the target cluster for kubectl access.
         */

        const importClusterProvider = new ImportClusterProvider({
            clusterName: sdkCluster.name!,
            version: eks.KubernetesVersion.of(sdkCluster.version!),
            clusterEndpoint: sdkCluster.endpoint,
            openIdConnectProvider: blueprints.getResource(context =>
                new blueprints.LookupOpenIdConnectProvider(sdkCluster.identity!.oidc!.issuer!).provide(context)),
            clusterCertificateAuthorityData: sdkCluster.certificateAuthority?.data,
            kubectlRoleArn: blueprints.getResource(context => new blueprints.LookupRoleProvider(kubectlRoleName).provide(context)).roleArn,
            clusterSecurityGroupId: sdkCluster.resourcesVpcConfig?.clusterSecurityGroupId
        });

        const addOns: Array<blueprints.ClusterAddOn> = [
            new blueprints.addons.CloudWatchLogsAddon({
                logGroupPrefix: `/aws/eks/${stackId}`,
                logRetentionDays: 30
            }),
            new blueprints.addons.ContainerInsightsAddOn(),
        ];

        ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .addExistingClusterObservabilityBuilderAddOns()
            .clusterProvider(importClusterProvider)
            .resourceProvider(blueprints.GlobalResources.Vpc, new blueprints.VpcProvider(vpcId)) // this is required with import cluster provider
            .addOns(...addOns)
            .build(scope, stackId);
    }
}
