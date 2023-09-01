import { Construct } from 'constructs';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { cloudWatchDeploymentMode } from '@aws-quickstart/eks-blueprints';
import { utils } from '@aws-quickstart/eks-blueprints';
import * as team from './teams/multi-account-monitoring'; // for teams implementation
import { ObservabilityBuilder } from '@aws-quickstart/eks-blueprints';

export default class CloudWatchMonitoringConstruct {

    build(scope: Construct, id: string, contextAccount?: string, contextRegion?: string ) {

        const stackId = `${id}-observability-accelerator`;

        const account = contextAccount! || process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = contextRegion! || process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;

        this.create(scope, account, region, stackId)
            .build(scope, stackId);
    }

    
    // build(scope: Construct, id: string, account?: string, region?: string ) {
    //     // Setup platform team
    //     const accountID = account ?? process.env.CDK_DEFAULT_ACCOUNT! ;
    //     const awsRegion =  region ?? process.env.CDK_DEFAULT_REGION! ;
 
    //     const stackID = `${id}-blueprint`;
    //     this.create(scope, accountID, awsRegion)
    //         .build(scope, stackID);
    // }

    create(scope: Construct, contextAccount?: string, contextRegion?: string, stackId?: string ) {
    
        const account = contextAccount! || process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = contextRegion! || process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;

        const cloudWatchAdotAddOn = new blueprints.addons.CloudWatchAdotAddOn({
            deploymentMode: cloudWatchDeploymentMode.DEPLOYMENT,
            namespace: 'default',
            name: 'adot-collector-cloudwatch',
            metricsNameSelectors: ['apiserver_request_.*', 'container_memory_.*', 'container_threads', 'otelcol_process_.*', 'ho11y*'],
            // podLabelRegex: 'frontend|downstream(.*)',
        });        

        Reflect.defineMetadata("ordered", true, blueprints.addons.CloudWatchLogsAddon);        
        const addOns: Array<blueprints.ClusterAddOn> = [
            new blueprints.addons.ClusterAutoScalerAddOn(),
            new blueprints.addons.SecretsStoreAddOn(),
            new blueprints.addons.CloudWatchLogsAddon({
                logGroupPrefix: `/aws/eks/${stackId}`,
                logRetentionDays: 30
            }),     
            /* already part of enableNativePatternAddOns 
            new blueprints.addons.AwsLoadBalancerControllerAddOn(), // part of enableOpenSourcePatternAddOns
            new blueprints.addons.CertManagerAddOn(), // part of enableOpenSourcePatternAddOns
            new blueprints.addons.KubeStateMetricsAddOn(), // part of enableOpenSourcePatternAddOns         
            new blueprints.addons.PrometheusNodeExporterAddOn(), // part of enableOpenSourcePatternAddOns
            */
        ];
  
        return ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .version('auto')
            .enableNativePatternAddOns()
            .addOns(...addOns)
            .teams(new team.TeamGeordi, new team.CorePlatformTeam);
    }  

    // create(scope: Construct, account?: string, region?: string ) {
    //     // Setup platform team
    //     const accountID = account ?? process.env.CDK_DEFAULT_ACCOUNT! ;
    //     const awsRegion =  region ?? process.env.CDK_DEFAULT_REGION! ;

    //     const cloudWatchAdotAddOn = new blueprints.addons.CloudWatchAdotAddOn({
    //         deploymentMode: cloudWatchDeploymentMode.DEPLOYMENT,
    //         namespace: 'default',
    //         name: 'adot-collector-cloudwatch',
    //         metricsNameSelectors: ['apiserver_request_.*', 'container_memory_.*', 'container_threads', 'otelcol_process_.*', 'ho11y*'],
    //         podLabelRegex: 'frontend|downstream(.*)' 
    //     });

    //     return blueprints.EksBlueprint.builder()
    //         .account(accountID)
    //         .region(awsRegion)
    //         .addOns(
    //             new blueprints.AwsLoadBalancerControllerAddOn,
    //             new blueprints.CertManagerAddOn,
    //             new blueprints.KubeStateMetricsAddOn,
    //             new blueprints.PrometheusNodeExporterAddOn,
    //             new blueprints.AdotCollectorAddOn,
    //             cloudWatchAdotAddOn,
    //             new blueprints.XrayAdotAddOn,
    //             new blueprints.NginxAddOn,
    //             new blueprints.ClusterAutoScalerAddOn,
    //             new blueprints.SecretsStoreAddOn
    //         )
    //         .teams(new team.TeamGeordi, new team.CorePlatformTeam);
    // }
}


