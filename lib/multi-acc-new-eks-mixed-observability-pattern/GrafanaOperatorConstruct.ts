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
            new blueprints.addons.AwsLoadBalancerControllerAddOn(), // part of enableOpenSourcePatternAddOns
            new blueprints.addons.CertManagerAddOn(), // part of enableOpenSourcePatternAddOns
            new blueprints.addons.KubeStateMetricsAddOn(), // part of enableOpenSourcePatternAddOns
            new blueprints.addons.PrometheusNodeExporterAddOn(), // part of enableOpenSourcePatternAddOns
            new blueprints.addons.AdotCollectorAddOn(), // part of enableOpenSourcePatternAddOns
            */               
        ];

        return ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .version('auto')
            .enableMixedPatternAddOns()
            .addOns(...addOns);
    }    

    // constructor(scope: Construct, id: string, inAccount?: string, inRegion?: string ) {
    //     // const stackId = `${id}-observability-accelerator`;

    //     // const account = inAccount! || process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
    //     // const region = inRegion! || process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;

    //     Reflect.defineMetadata("ordered", true, blueprints.addons.GrafanaOperatorAddon); //sets metadata ordered to true for GrafanaOperatorAddon        

    //     // ArgoCD configuration
    //     const grafanaOperatorArgoAddonConfig = createArgoAddonConfig('monitoring','https://github.com/iamprakkie/one-observability-demo.git','grafana-operator-chart');
    //     // const grafanaOperatorArgoAddonConfig = createArgoAddonConfig('prod', 'https://github.com/aws-samples/one-observability-demo.git','grafana-operator-manifests'); 

    //     const addOns: Array<blueprints.ClusterAddOn> = [
    //         new blueprints.addons.KubeProxyAddOn(),
    //         new blueprints.addons.AwsLoadBalancerControllerAddOn(),
    //         new blueprints.addons.CertManagerAddOn(),
    //         new blueprints.addons.AdotCollectorAddOn(),
    //         new blueprints.addons.XrayAdotAddOn(),
    //         new blueprints.addons.ExternalsSecretsAddOn(),
    //         new blueprints.addons.GrafanaOperatorAddon({
    //             createNamespace: true,
    //         }),
    //         new GrafanaOperatorSecretAddon(),
    //         grafanaOperatorArgoAddonConfig, // GitOps through ArgoCD
    //     ];

    //     ObservabilityBuilder.builder()
    //         .account(account)
    //         .region(region)
    //         .enableMixedPatternAddOns()
    //         .addOns(...addOns)
    //         .build(scope, stackId);

    // }

}
