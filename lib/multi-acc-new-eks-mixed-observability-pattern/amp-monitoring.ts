import { Construct } from 'constructs';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import * as amp from 'aws-cdk-lib/aws-aps';
import { utils } from '@aws-quickstart/eks-blueprints';
import * as team from './teams/multi-account-monitoring'; // Team implementations
import { ObservabilityBuilder } from '@aws-quickstart/eks-blueprints';

export default class AmpMonitoringConstruct {

    build(scope: Construct, id: string, contextAccount?: string, contextRegion?: string ) {

        const stackId = `${id}-observability-accelerator`;

        const account = contextAccount! || process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = contextRegion! || process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;

        this.create(scope, account, region)
            .build(scope, stackId);
    }

    create(scope: Construct, contextAccount?: string, contextRegion?: string ) {
    
        const account = contextAccount! || process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = contextRegion! || process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;
        const ampWorkspaceName = process.env.COA_AMP_WORKSPACE_NAME! || 'observability-amp-Workspace';
        const ampWorkspace = blueprints.getNamedResource(ampWorkspaceName) as unknown as amp.CfnWorkspace;
        const ampEndpoint = ampWorkspace.attrPrometheusEndpoint;
        const ampWorkspaceArn = ampWorkspace.attrArn;

        const ampAddOnProps: blueprints.AmpAddOnProps = {
            ampPrometheusEndpoint: ampEndpoint,
            ampRules: {
                ampWorkspaceArn: ampWorkspaceArn,
                ruleFilePaths: [
                    __dirname + '/../common/resources/amp-config/alerting-rules.yml',
                    __dirname + '/../common/resources/amp-config/recording-rules.yml'
                ]
            }
        };

        if (utils.valueFromContext(scope, "java.pattern.enabled", false)) {
            ampAddOnProps.openTelemetryCollector = {
                manifestPath: __dirname + '/../common/resources/otel-collector-config.yml',
                manifestParameterMap: {
                    javaScrapeSampleLimit: 1000,
                    javaPrometheusMetricsEndpoint: "/metrics"
                }
            };
            ampAddOnProps.ampRules?.ruleFilePaths.push(
                __dirname + '/../common/resources/amp-config/java/alerting-rules.yml',
                __dirname + '/../common/resources/amp-config/java/recording-rules.yml'
            );
        }

        const addOns: Array<blueprints.ClusterAddOn> = [
            // new blueprints.addons.AwsLoadBalancerControllerAddOn(), // part of enableOpenSourcePatternAddOns
            new blueprints.addons.CertManagerAddOn(),
            new blueprints.addons.KubeStateMetricsAddOn(),
            new blueprints.addons.PrometheusNodeExporterAddOn(),
            new blueprints.addons.AdotCollectorAddOn(),
            new blueprints.addons.XrayAdotAddOn(),
            new blueprints.addons.NginxAddOn(),
            new blueprints.addons.ClusterAutoScalerAddOn(),
            new blueprints.addons.SecretsStoreAddOn()      
        ];

        return ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .version('auto')
            .enableOpenSourcePatternAddOns(ampAddOnProps)
            .resourceProvider(ampWorkspaceName, new blueprints.CreateAmpProvider(ampWorkspaceName, ampWorkspaceName))
            .addOns(...addOns)
            .teams(new team.TeamGeordi, new team.CorePlatformTeam);
    }    
        


}



    // build(scope: Construct, id: string, account?: string, region?: string ) {
    //     // Setup platform team
    //     const accountID = account ?? process.env.CDK_DEFAULT_ACCOUNT! ;
    //     const awsRegion =  region ?? process.env.CDK_DEFAULT_REGION! ;
 
    //     const stackID = `${id}-blueprint`;
    //     this.create(scope, accountID, awsRegion)
    //         .build(scope, stackID);
    // }

    // create(scope: Construct, account?: string, region?: string ) {
    //     // Setup platform team
    //     const accountID = account ?? process.env.CDK_DEFAULT_ACCOUNT! ;
    //     const awsRegion =  region ?? process.env.CDK_DEFAULT_REGION! ;
    //     const ampWorkspaceName = "multi-account-monitoring";
    //     const ampPrometheusEndpoint = (blueprints.getNamedResource(ampWorkspaceName) as unknown as amp.CfnWorkspace).attrPrometheusEndpoint;

    //     return blueprints.EksBlueprint.builder()
    //         .account(accountID)
    //         .region(awsRegion)
    //         .version('auto')
    //         .resourceProvider(ampWorkspaceName, new blueprints.CreateAmpProvider(ampWorkspaceName, ampWorkspaceName))
    //         .addOns(
    //             new blueprints.AwsLoadBalancerControllerAddOn,
    //             new blueprints.CertManagerAddOn,
    //             new blueprints.KubeStateMetricsAddOn,
    //             new blueprints.PrometheusNodeExporterAddOn,
    //             new blueprints.AdotCollectorAddOn,
    //             new blueprints.addons.AmpAddOn({
    //                 ampPrometheusEndpoint: ampPrometheusEndpoint,
    //             }),
    //             new blueprints.XrayAdotAddOn,
    //             new blueprints.NginxAddOn,
    //             new blueprints.ClusterAutoScalerAddOn,
    //             new blueprints.SecretsStoreAddOn
    //         )
    //         .teams(new team.TeamGeordi, new team.CorePlatformTeam);
    // }
