// import { Construct } from 'constructs';
import { ImportClusterProvider, utils } from '@aws-quickstart/eks-blueprints';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { GrafanaOperatorSecretAddon } from './grafanaoperatorsecretaddon';
import * as amp from 'aws-cdk-lib/aws-aps';
import { ObservabilityBuilder } from '../common/observability-builder';
import * as cdk from "aws-cdk-lib";
import * as eks from 'aws-cdk-lib/aws-eks';
import { AmpRulesConfiguratorAddOn } from '../common/addons/amp-rules-configurator/amp-rules-configurator-addon';

export default class ExistingEksOpenSourceobservabilityConstruct {
    async buildAsync(scope: cdk.App, id: string) {
        // AddOns for the cluster
        const stackId = `${id}-observability-accelerator`;
        const clusterName = utils.valueFromContext(scope, "existing.cluster.name", undefined);
        const kubectlRoleName = utils.valueFromContext(scope, "existing.kubectl.rolename", undefined);

        const account = process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;
        const ampWorkspaceName = process.env.COA_AMP_WORKSPACE_NAME! || 'observability-amp-Workspace';
        const ampWorkspace = blueprints.getNamedResource(ampWorkspaceName) as unknown as amp.CfnWorkspace;
        const ampEndpoint = ampWorkspace.attrPrometheusEndpoint;
        const ampWorkspaceArn = ampWorkspace.attrArn;
                
        const amgEndpointUrl = process.env.COA_AMG_ENDPOINT_URL;
        const sdkCluster = await blueprints.describeCluster(clusterName, region); // get cluster information using EKS APIs
        const vpcId = sdkCluster.resourcesVpcConfig?.vpcId;

        /**
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

        // All Grafana Dashboard URLs from `cdk.json` if presentgi
        const grafanaGitOpsConfig: blueprints.FluxCDAddOnProps = utils.valueFromContext(scope, "grafanaGitOpsConfig", undefined);
        grafanaGitOpsConfig.bootstrapValues!.AMG_AWS_REGION = region;
        grafanaGitOpsConfig.bootstrapValues!.AMP_ENDPOINT_URL = ampEndpoint;
        grafanaGitOpsConfig.bootstrapValues!.AMG_ENDPOINT_URL = amgEndpointUrl;

        Reflect.defineMetadata("ordered", true, blueprints.addons.GrafanaOperatorAddon);
        const addOns: Array<blueprints.ClusterAddOn> = [
            new blueprints.addons.CloudWatchLogsAddon({
                logGroupPrefix: `/aws/eks/${stackId}`,
                logRetentionDays: 30
            }),
            new blueprints.addons.AdotCollectorAddOn(),
            new blueprints.addons.AmpAddOn({
                ampPrometheusEndpoint: ampEndpoint,
            }),
            new AmpRulesConfiguratorAddOn({
                ampWorkspaceArn: ampWorkspaceArn,
                ruleFilePaths: [
                    __dirname + '/../common/addons/amp-rules-configurator/alerting-rules.yml',
                    __dirname + '/../common/addons/amp-rules-configurator/recording-rules.yml'
                ]
            }),
            new blueprints.addons.XrayAdotAddOn(),
            new blueprints.addons.ExternalsSecretsAddOn(),
            new blueprints.addons.GrafanaOperatorAddon({
                version: 'v5.0.0-rc3'
            }),
            new blueprints.addons.FluxCDAddOn(grafanaGitOpsConfig),
            new GrafanaOperatorSecretAddon(),
        ];

        ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .addExistingClusterObservabilityBuilderAddOns()
            .clusterProvider(importClusterProvider)
            .resourceProvider(blueprints.GlobalResources.Vpc, new blueprints.VpcProvider(vpcId)) // this is required with import cluster provider
            .resourceProvider(ampWorkspaceName, new blueprints.CreateAmpProvider(ampWorkspaceName, ampWorkspaceName))
            .addOns(...addOns)
            .build(scope, stackId);
    }
}
