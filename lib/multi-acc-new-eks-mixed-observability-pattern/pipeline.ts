import * as blueprints from '@aws-quickstart/eks-blueprints';
import { utils } from '@aws-quickstart/eks-blueprints';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import AmpMonitoringConstruct from './amp-monitoring';
import CloudWatchMonitoringConstruct from './cloudwatch-monitoring';
import GrafanaOperatorConstruct from "./GrafanaOperatorConstruct";
import { AmgIamSetupStack, AmgIamSetupStackProps } from './amg-iam-setup';
import { CreateIAMRoleStack, CreateIAMRoleStackProps } from './CreateIAMRole';
import { AmpIamSetupStack } from './amp-iam-setup';
import { CloudWatchIamSetupStack } from './cloudwatch-iam-setup';
import { getSSMSecureString } from './getSSMSecureString';

const logger = blueprints.utils.logger;

type repoTypeValues = 'public' | 'private';

let amgWorkspaceUrl: string;
let clusterDashUrl: string;
let kubeletDashUrl: string;
let namespaceWorkloadsDashUrl: string;
let nodeExporterDashUrl: string;
let nodesDashUrl: string;
let workloadsDashUrl: string;

/**
 * Function relies on a secret called "cdk-context" defined in COA_PIPELINE_REGION region in pipeline account. Its a MANDATORY STEP.
 * @returns 
 */
export async function populateAccountWithContextDefaults(region: string): Promise<PipelineMultiEnvMonitoringProps> {
    const cdkContext = JSON.parse(await getSSMSecureString('/cdk-accelerator/cdk-context',region))['context'] as PipelineMultiEnvMonitoringProps;
    logger.debug(`Retrieved CDK context ${JSON.stringify(cdkContext)}`);
    return cdkContext;
}

/*
* prodEnv1: PROD1 account ID and region
* prodEnv2: PROD2 account ID and region 
* monitoringEnv: MON account ID and region 
 */
export interface PipelineMultiEnvMonitoringProps {
    prodEnv1: cdk.Environment;
    prodEnv2: cdk.Environment;
    pipelineEnv: cdk.Environment;
    monitoringEnv: cdk.Environment;
}

/*
 * Main multi-account monitoring pipeline.
 */
export class PipelineMultiEnvMonitoring {

    readonly pipelineRegion = process.env.COA_PIPELINE_REGION! || process.env.CDK_DEFAULT_REGION!;
    
    async buildAsync(scope: Construct) {

        // All Grafana Dashboard URLs from `cdk.json` if present
        clusterDashUrl = utils.valueFromContext(scope, "cluster.dashboard.url", undefined);
        kubeletDashUrl = utils.valueFromContext(scope, "kubelet.dashboard.url", undefined);
        namespaceWorkloadsDashUrl = utils.valueFromContext(scope, "namespaceworkloads.dashboard.url", undefined);
        nodeExporterDashUrl = utils.valueFromContext(scope, "nodeexporter.dashboard.url", undefined);
        nodesDashUrl = utils.valueFromContext(scope, "nodes.dashboard.url", undefined);
        workloadsDashUrl = utils.valueFromContext(scope, "workloads.dashboard.url", undefined);        

        // Checks for Git Owner
        if (!this.pipelineRegion) {
            logger.debug("ERROR: COA_PIPELINE_REGION or CDK_DEFAULT_REGION environment variable is not defined.");
            process.exit(101);
        }

        // environments IDs consts
        const context = await populateAccountWithContextDefaults(this.pipelineRegion);

        const PROD1_ENV_ID = `coa-eks-prod1-${context.prodEnv1.region}`;
        const PROD2_ENV_ID = `coa-eks-prod2-${context.prodEnv2.region}`;
        const MON_ENV_ID = `coa-cntrl-mon-${context.monitoringEnv.region}`;
        
        // Get AMG info from SSM SecureString
        const amgInfo = JSON.parse(await getSSMSecureString('/cdk-accelerator/amg-info',this.pipelineRegion))['amg'];
        amgWorkspaceUrl = amgInfo.workspaceURL;
        const amgWorkspaceIAMRoleARN = amgInfo.workspaceIAMRoleARN;

        //Props for cross-account trust role in PROD1 account to trust AMG from MON account, inorder to access PROD1's AMP
        const AMGTrustRoleStackProps: CreateIAMRoleStackProps = {
            roleName: "AMPAccessForTrustedAMGRole",
            trustArn: amgWorkspaceIAMRoleARN!,
            actions: [
                "aps:ListWorkspaces",
                "aps:DescribeWorkspace",
                "aps:QueryMetrics",
                "aps:GetLabels",
                "aps:GetSeries",
                "aps:GetMetricMetadata",
                "xray:PutTraceSegments",
                "xray:PutTelemetryRecords",
                "xray:GetSamplingRules",
                "xray:GetSamplingTargets",
                "xray:GetSamplingStatisticSummaries",
                "xray:BatchGetTraces",
                "xray:GetServiceGraph",
                "xray:GetTraceGraph",
                "xray:GetTraceSummaries",
                "xray:GetGroups",
                "xray:GetGroup",
                "xray:ListTagsForResource",
                "xray:GetTimeSeriesServiceStatistics",
                "xray:GetInsightSummaries",
                "xray:GetInsight",
                "xray:GetInsightEvents",
                "xray:GetInsightImpactGraph",
                "ssm:GetParameter"
            ],
            resources: ["*"]
        }

        //Cross Account Trust Role for PROD1 account to trust MON account to get AMP workspace URL
        //Props for cross-account trust role in PROD1 account to trust MON account, inorder share PROD1's AMP workspace URL
        const trustedMONAccArn = `arn:aws:iam::${context.monitoringEnv.account}:role/crossAccAMPInfoFromPROD1Role`;
        const ShareAMPInfoTrustRoleStackProps: CreateIAMRoleStackProps = {
            roleName: "AMPInfoForTrustedMonAccRole",
            trustArn: trustedMONAccArn!,
            actions: [
                "aps:ListWorkspaces",
                "aps:DescribeWorkspace",
                "ssm:GetParameter",
                "xray:GetGroup"
            ],
            resources: ["*"]    
        }        


        //creating constructs
        const ampConstruct = new AmpMonitoringConstruct();
        const blueprintAmp = ampConstruct.create(scope, context.prodEnv1.account, context.prodEnv1.region);
        const blueprintCloudWatch = new CloudWatchMonitoringConstruct().create(scope, context.prodEnv2.account, context.prodEnv2.region, PROD2_ENV_ID);
        const blueprintAmg = new GrafanaOperatorConstruct().create(scope, context.monitoringEnv.account, context.monitoringEnv.region);

        // Argo configuration per environment
        // CHANGE ME FINALLY
        const prodArgoAddonConfig = createArgoAddonConfig(
            'https://github.com/iamprakkie/aws-observability-accelerator.git',
            'artifacts/sample-apps/envs/prod',
            'artifacts',
            'public'
        );

        // CHANGE ME FINALLY HERE AS WELL AS IN APP'S VALUES.YAML
        const grafanaOperatorArgoAddonConfig = createGOArgoAddonConfig(
            context.prodEnv1.account, context.prodEnv1.region, 
            context.prodEnv2.account, context.prodEnv2.region,
            'https://github.com/iamprakkie/aws-observability-accelerator.git',
            'artifacts/sample-apps/grafana-operator-app',
            'artifacts',
            'private'
        );

        const AmgIamSetupStackProps: AmgIamSetupStackProps = {
            // roleName: "amgWorkspaceIamRole",
            roleArn: amgWorkspaceIAMRoleARN,
            accounts: [context.prodEnv1.account!, context.prodEnv2.account!]
        };

        // get CodePipeline Source Github info
        // const gitOwner = 'aws-samples'; 
        const pipelineSrcInfo = JSON.parse(await getSSMSecureString('/cdk-accelerator/pipeline-git-info',this.pipelineRegion))['pipelineSource'];
        const gitOwner = pipelineSrcInfo.gitOwner;
        const gitRepositoryName = pipelineSrcInfo.gitRepoName;
        const gitBranch = pipelineSrcInfo.gitBranch;


        const pipeline = blueprints.CodePipelineStack.builder()
            .application("npx ts-node bin/multi-acc-new-eks-mixed-observability.ts")
            .name("multi-acc-central-pipeline")
            .owner(gitOwner)
            .codeBuildPolicies([ 
                new iam.PolicyStatement({
                    resources: ["*"],
                    actions: [    
                        "sts:AssumeRole",
                        "secretsmanager:GetSecretValue",
                        "secretsmanager:DescribeSecret",
                        "cloudformation:*",
                        "ssm:GetParameter",
                        "ssm:PutParameter",
                        "ssm:DescribeParameter"
                    ]
                })
            ])
            .repository({
                repoUrl: gitRepositoryName,
                credentialsSecretName: 'github-token',
                // targetRevision: 'main',
                // UPDATE ME FINALLY
                targetRevision: gitBranch, 
            })
            .enableCrossAccountKeys();

            const monStage: blueprints.StackStage = {
                id: MON_ENV_ID,
                stackBuilder: blueprintAmg
                    .name(MON_ENV_ID)
                    .clone(context.monitoringEnv.region, context.monitoringEnv.account)
                    .addOns(new blueprints.NestedStackAddOn({
                        builder: AmgIamSetupStack.builder(AmgIamSetupStackProps),
                        id: "amg-iam-nested-stack"
                    }))
                    .addOns(
                        grafanaOperatorArgoAddonConfig,
                    )
            };           

            const ampStage: blueprints.StackStage = {
                id: PROD1_ENV_ID,
                stackBuilder: blueprintAmp
                    .name(PROD1_ENV_ID)                        
                    .clone(context.prodEnv1.region, context.prodEnv1.account)
                    .version('auto')
                    .addOns(new blueprints.NestedStackAddOn({
                        // builder: AmpIamSetupStack.builder("AMPAccessForTrustedAMGRole", amgWorkspaceIAMRoleARN!),
                        builder: CreateIAMRoleStack.builder(AMGTrustRoleStackProps),
                        id: "amp-ds-trustrole-nested-stack"
                    }))
                    .addOns(new blueprints.NestedStackAddOn({
                        builder: CreateIAMRoleStack.builder(ShareAMPInfoTrustRoleStackProps),
                        id: "amp-info-trustrole-nested-stack"
                    }))                           
                    .addOns(
                        prodArgoAddonConfig,
                    )
            };

            const cwStage: blueprints.StackStage = {
                    id: PROD2_ENV_ID,
                    stackBuilder: blueprintCloudWatch
                        .name(PROD2_ENV_ID)
                        .clone(context.prodEnv2.region, context.prodEnv2.account)
                        .addOns(new blueprints.NestedStackAddOn({
                            builder: CloudWatchIamSetupStack.builder("cloudwatchDataSourceRole", amgWorkspaceIAMRoleARN!),
                            id: "cloudwatch-iam-nested-stack"
                        }))
                        .addOns(
                            prodArgoAddonConfig,
                        )
            };

            pipeline.stage(monStage);

            // pipeline.wave({
            //     id: "multi-acc-stage-01",
            //     stages: [
            //         {
            //             id: PROD1_ENV_ID,
            //             stackBuilder: blueprintAmp
            //                 .name(PROD1_ENV_ID)                        
            //                 .clone(context.prodEnv1.region, context.prodEnv1.account)
            //                 .version('auto')
            //                 .addOns(new blueprints.NestedStackAddOn({
            //                     // builder: AmpIamSetupStack.builder("AMPAccessForTrustedAMGRole", amgWorkspaceIAMRoleARN!),
            //                     builder: CreateIAMRoleStack.builder(AMGTrustRoleStackProps),
            //                     id: "amp-ds-trustrole-nested-stack"
            //                 }))
            //                 .addOns(new blueprints.NestedStackAddOn({
            //                     builder: CreateIAMRoleStack.builder(ShareAMPInfoTrustRoleStackProps),
            //                     id: "amp-info-trustrole-nested-stack"
            //                 }))                           
            //                 .addOns(
            //                     prodArgoAddonConfig,
            //                 )
            //         },
            //         // {
            //         //     id: PROD2_ENV_ID,
            //         //     stackBuilder: blueprintCloudWatch
            //         //         .name(PROD2_ENV_ID)
            //         //         .clone(context.prodEnv2.region, context.prodEnv2.account)
            //         //         .addOns(new blueprints.NestedStackAddOn({
            //         //             builder: CloudWatchIamSetupStack.builder("cloudwatchDataSourceRole", amgWorkspaceIAMRoleARN!),
            //         //             id: "cloudwatch-iam-nested-stack"
            //         //         }))
            //         //         .addOns(
            //         //             prodArgoAddonConfig,
            //         //         )
            //         // },     
            //     ],
            // });
            
            pipeline.build(scope, "multi-account-central-pipeline", {
                env: context.pipelineEnv
            });




            // pipeline.wave({
            //     id: "multi-acc-stages",
            //     stages: [
            //         {
            //             id: PROD1_ENV_ID,
            //             stackBuilder: blueprintAmp
            //                 .name(PROD1_ENV_ID)                        
            //                 .clone(context.prodEnv1.region, context.prodEnv1.account)
            //                 .version('auto')
            //                 .addOns(new blueprints.NestedStackAddOn({
            //                     // builder: AmpIamSetupStack.builder("AMPAccessForTrustedAMGRole", amgWorkspaceIAMRoleARN!),
            //                     builder: CreateIAMRoleStack.builder(AMGTrustRoleStackProps),
            //                     id: "amp-ds-trustrole-nested-stack"
            //                 }))
            //                 .addOns(new blueprints.NestedStackAddOn({
            //                     builder: CreateIAMRoleStack.builder(ShareAMPInfoTrustRoleStackProps),
            //                     id: "amp-info-trustrole-nested-stack"
            //                 }))                           
            //                 .addOns(
            //                     prodArgoAddonConfig,
            //                 )
            //         },
            //         {
            //             id: PROD2_ENV_ID,
            //             stackBuilder: blueprintCloudWatch
            //                 .name(PROD2_ENV_ID)
            //                 .clone(context.prodEnv2.region, context.prodEnv2.account)
            //                 .addOns(new blueprints.NestedStackAddOn({
            //                     builder: CloudWatchIamSetupStack.builder("cloudwatchDataSourceRole", amgWorkspaceIAMRoleARN!),
            //                     id: "cloudwatch-iam-nested-stack"
            //                 }))
            //                 .addOns(
            //                     prodArgoAddonConfig,
            //                 )
            //         },
            //         {
            //             id: MON_ENV_ID,
            //             stackBuilder: blueprintAmg
            //                 .name(MON_ENV_ID)
            //                 .clone(context.monitoringEnv.region, context.monitoringEnv.account)
            //                 .addOns(new blueprints.NestedStackAddOn({
            //                     builder: AmgIamSetupStack.builder(AmgIamSetupStackProps),
            //                     id: "amg-iam-nested-stack"
            //                 }))
            //                 .addOns(
            //                     grafanaOperatorArgoAddonConfig,
            //                 )
            //         },       
            //     ],
            // })
            // .build(scope, "multi-account-central-pipeline", {
            //     env: context.pipelineEnv
            // });

    }
}

function createArgoAddonConfig(repoUrl: string, path: string, branch?: string, repoType?: repoTypeValues): blueprints.ArgoCDAddOn {

    branch = branch! || 'main';
    repoType = repoType! || 'public';

    let ArgoCDAddOnProps: blueprints.ArgoCDAddOnProps;

    if (repoType.toLocaleLowerCase() === 'public') {
        ArgoCDAddOnProps = {
            bootstrapRepo: {
                repoUrl: repoUrl,
                path: path,
                targetRevision: branch,
            },
        }
    } else {

        ArgoCDAddOnProps = {
            bootstrapRepo: {
                repoUrl: repoUrl,
                path: path,
                targetRevision: branch,
                credentialsSecretName: 'github-ssh-key', // for access to private repo. This needs SecretStoreAddOn added to your cluster. Ensure github-ssh-key secret exists in pipeline account at COA_REGION
                credentialsType: 'SSH',
            },                     
        }        
    }    
    return new blueprints.ArgoCDAddOn(ArgoCDAddOnProps);
}

function createGOArgoAddonConfig(ampAccount: string | undefined, ampRegion: string | undefined, cwAccount: string | undefined, cwRegion: string | undefined, repoUrl: string, path: string, branch?: string, repoType?: repoTypeValues): blueprints.ArgoCDAddOn {

    branch = branch! || 'main';
    repoType = repoType! || 'public';

    const ampAssumeRoleArn = `arn:aws:iam::${ampAccount}:role/AMPAccessForTrustedAMGRole`
    const cwAssumeRoleArn = `arn:aws:iam::${cwAccount}:role/cloudwatchDataSourceRole`

    let ArgoCDAddOnProps: blueprints.ArgoCDAddOnProps;

    if (repoType.toLocaleLowerCase() === 'public') {
        ArgoCDAddOnProps = {
            bootstrapRepo: {
                repoUrl: repoUrl,
                path: path,
                targetRevision: branch,
            },
        }
    } else {

        ArgoCDAddOnProps = {
            bootstrapRepo: {
                repoUrl: repoUrl,
                path: path,
                targetRevision: branch,
                credentialsSecretName: 'github-ssh-key', // for access to private repo. This needs SecretStoreAddOn added to your cluster. Ensure github-ssh-key secret exists in pipeline account at COA_REGION
                credentialsType: 'SSH',
            },                     
        }        
    }

    ArgoCDAddOnProps.bootstrapValues = {
        AMP_ASSUME_ROLE_ARN: ampAssumeRoleArn,
        AMP_AWS_REGION: ampRegion,
        CW_ASSUME_ROLE_ARN: cwAssumeRoleArn,
        CW_AWS_REGION: cwRegion,        
        AMP_ENDPOINT_URL: 'UPDATE_ME_WITH_AMP_ENDPOINT_URL',
        AMG_ENDPOINT_URL: amgWorkspaceUrl,
        GRAFANA_CLUSTER_DASH_URL: clusterDashUrl,
        GRAFANA_KUBELET_DASH_URL: kubeletDashUrl,
        GRAFANA_NSWRKLDS_DASH_URL: namespaceWorkloadsDashUrl,
        GRAFANA_NODEEXP_DASH_URL: nodeExporterDashUrl,
        GRAFANA_NODES_DASH_URL: nodesDashUrl,
        GRAFANA_WORKLOADS_DASH_URL: workloadsDashUrl
    };

    // ArgoCDAddOnProps.values = {
    //     server: {  // By default argocd-server is not publicaly exposed. uncomment this section, if you need to expose using ALB
    //         service: {
    //             type: 'LoadBalancer'
    //         }
    //     }
    // };       
    
    return new blueprints.ArgoCDAddOn(ArgoCDAddOnProps);
}