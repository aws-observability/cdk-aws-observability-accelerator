import { Construct } from 'constructs';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { ObservabilityBuilder } from '@aws-quickstart/eks-blueprints';
import { GrafanaOperatorSecretAddon } from './grafanaoperatorsecretaddon';

export default class GrafanaOperatorConstruct {

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

        Reflect.defineMetadata("ordered", true, blueprints.addons.GrafanaOperatorAddon); //sets metadata ordered to true for GrafanaOperatorAddon 
                
        const addOns: Array<blueprints.ClusterAddOn> = [
            new blueprints.addons.XrayAdotAddOn(),
            new blueprints.addons.ClusterAutoScalerAddOn(),
            new blueprints.addons.SecretsStoreAddOn(),
            new blueprints.addons.ExternalsSecretsAddOn(),
            new blueprints.addons.GrafanaOperatorAddon({
                createNamespace: true,
            }),
            new GrafanaOperatorSecretAddon(),
            // grafanaOperatorArgoAddonConfig, // ArgoCD config for grafana-operator             
            /* already part of enableOpenSourcePatternAddOns
            new blueprints.addons.AwsLoadBalancerControllerAddOn(),
            new blueprints.addons.CertManagerAddOn(),
            new blueprints.addons.KubeStateMetricsAddOn(),
            new blueprints.addons.PrometheusNodeExporterAddOn(),
            new blueprints.addons.AdotCollectorAddOn(),
            */               
        ];

        return ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .version('auto')
            .enableMixedPatternAddOns()
            .addOns(...addOns);
    }    

}
