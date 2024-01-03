import { Construct } from 'constructs';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { ObservabilityBuilder } from '@aws-quickstart/eks-blueprints';
import * as eks from 'aws-cdk-lib/aws-eks';


export default class SingleNewEksAWSNativeFargateobservabilityConstruct {
    constructor(scope: Construct, id: string) {
        // AddOns for the cluster
        const stackId = `${id}-observability-accelerator`;

        const account = process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
        const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;

        const cloudWatchAdotAddOn = new blueprints.addons.CloudWatchAdotAddOn({
            deploymentMode: blueprints.cloudWatchDeploymentMode.DEPLOYMENT,
            namespace: 'default',
            name: 'adot-collector-cloudwatch',
            metricsNameSelectors: ['apiserver_request_.*', 'container_memory_.*', 'container_threads', 'otelcol_process_.*', "ho11y*"],
            podLabelRegex: 'frontend|downstream(.*)',
        });
        
        const addOns: Array<blueprints.ClusterAddOn> = [
            new blueprints.addons.CloudWatchLogsAddon({
                logGroupPrefix: `/aws/eks/${stackId}`,
                logRetentionDays: 30
            }),
            cloudWatchAdotAddOn,
            new blueprints.addons.XrayAdotAddOn(),
        ];

        const fargateProfiles: Map<string, eks.FargateProfileOptions> = new Map([
            ["MyProfile", { selectors: [
                { namespace: "cert-manager" },
                { namespace: "opentelemetry-operator-system" }
            ]}]
        ]);

        // Define fargate cluster provider and pass the profile options
        const fargateClusterProvider : blueprints.FargateClusterProvider = new blueprints.FargateClusterProvider({
            fargateProfiles,
            version: eks.KubernetesVersion.of("1.28")
        });

        const certManagerAddOnProps : blueprints.CertManagerAddOnProps = {
            installCRDs:true,
            createNamespace:true,
            namespace:"cert-manager",
            values:{webhook: {securePort: 10260}}
        };

        const coreDnsAddOnProps : blueprints.CoreDnsAddOnProps = {
            version:"v1.10.1-eksbuild.4",
            configurationValues:{
                computeType: "Fargate" 
            }
        };
        
        /* Use observability builder mixed pattern addons, aws native containerInsightsAddon
            causes conflict in fargate */
        ObservabilityBuilder.builder()
            .account(account)
            .region(region)
            .withCertManagerProps(certManagerAddOnProps)
            .withCoreDnsProps(coreDnsAddOnProps)
            .enableFargatePatternAddOns()
            .enableControlPlaneLogging()
            .clusterProvider(fargateClusterProvider)
            .addOns(...addOns)
            .build(scope, stackId);
    }
}
