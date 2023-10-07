import { Construct } from 'constructs';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { cloudWatchDeploymentMode } from '@aws-quickstart/eks-blueprints';
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

    create(scope: Construct, contextAccount?: string, contextRegion?: string, Id?: string ) {

        const account = contextAccount! || process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = contextRegion! || process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;

        const cloudWatchAdotAddOn = new blueprints.addons.CloudWatchAdotAddOn({
            deploymentMode: cloudWatchDeploymentMode.DEPLOYMENT,
            namespace: 'default',
            name: 'adot-collector-cloudwatch',
            metricsNameSelectors: ['apiserver_request_.*', 'container_memory_.*', 'container_threads', 'otelcol_process_.*', 'ho11y*'],
            podLabelRegex: 'frontend|downstream(.*)',
        });

        Reflect.defineMetadata("ordered", true, blueprints.addons.CloudWatchLogsAddon);
        const addOns: Array<blueprints.ClusterAddOn> = [
            cloudWatchAdotAddOn,
            new blueprints.addons.XrayAdotAddOn(),
            new blueprints.addons.ClusterAutoScalerAddOn(),
            new blueprints.addons.SecretsStoreAddOn(),
            new blueprints.addons.CloudWatchLogsAddon({
                logGroupPrefix: `/aws/eks/${Id}`,
                logRetentionDays: 30
            }),
        ];

        return ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .version('auto')
            .enableMixedPatternAddOns()
            .addOns(...addOns)
            .teams(new team.TeamGeordi, new team.CorePlatformTeam);
    }
}


