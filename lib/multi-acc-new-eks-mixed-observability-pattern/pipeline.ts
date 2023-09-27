import * as blueprints from '@aws-quickstart/eks-blueprints';
import { utils } from '@aws-quickstart/eks-blueprints';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import AmpMonitoringConstruct from './amp-monitoring';
import CloudWatchMonitoringConstruct from './cloudwatch-monitoring';
import GrafanaOperatorConstruct from "./grafana-operator-index";
import { AmgIamSetupStack, AmgIamSetupStackProps } from './amg-iam-setup';
import { getAMPAccessPolicyDocument } from './amp-access-policy';
import { getCWAccessPolicyDocument } from './cw-access-policy';
import { getCodeBuildPolicyDocument } from './codebuild-policy';
import { CreateIAMRoleNestedStack, CreateIAMRoleNestedStackProps } from './create-iam-role';
import { getSSMSecureString } from './get-ssm-securestring';

const logger = blueprints.utils.logger;

let ampAccount: string;
let ampRegion: string;
let cwAccount: string;
let cwRegion: string;
let monAccount: string;
let monRegion: string;

type repoTypeValues = 'public' | 'private';

let ampAssumeRoleName: string;
let cwAssumeRoleName: string;
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

        ampAccount = context.prodEnv1.account as string;
        ampRegion = context.prodEnv1.region as string;
        cwAccount = context.prodEnv2.account as string;
        cwRegion = context.prodEnv2.region as string;
        monAccount = context.monitoringEnv.account as string;
        monRegion = context.monitoringEnv.region as string;

        const PROD1_ENV_ID = `coa-eks-prod1-${context.prodEnv1.region}`;
        const PROD2_ENV_ID = `coa-eks-prod2-${context.prodEnv2.region}`;
        const MON_ENV_ID = `coa-cntrl-mon-${context.monitoringEnv.region}`;

        // Get AMG info from SSM SecureString
        const amgInfo = JSON.parse(await getSSMSecureString('/cdk-accelerator/amg-info',this.pipelineRegion))['amg'];
        amgWorkspaceUrl = amgInfo.workspaceURL;
        const amgWorkspaceIAMRoleARN = amgInfo.workspaceIAMRoleARN;

        // Props for cross-account trust role in PROD1 account to trust AMG from MON account, inorder to access PROD1's AMP
        ampAssumeRoleName = "AMPAccessForTrustedAMGRole";
        const AMPAccessRoleStackProps: CreateIAMRoleNestedStackProps = {
            roleName: ampAssumeRoleName!,
            trustArn: amgWorkspaceIAMRoleARN!,
            statement: getAMPAccessPolicyDocument()
        };
        // const AMPAccessRoleStackProps: CreateIAMRoleNestedStackProps = {
        //     roleName: ampAssumeRoleName!,
        //     trustArn: amgWorkspaceIAMRoleARN!,
        //     actions: [
        //         "aps:ListWorkspaces",
        //         "aps:DescribeWorkspace",
        //         "aps:QueryMetrics",
        //         "aps:GetLabels",
        //         "aps:GetSeries",
        //         "aps:GetMetricMetadata",
        //         "xray:PutTraceSegments",
        //         "xray:PutTelemetryRecords",
        //         "xray:GetSamplingRules",
        //         "xray:GetSamplingTargets",
        //         "xray:GetSamplingStatisticSummaries",
        //         "xray:BatchGetTraces",
        //         "xray:GetServiceGraph",
        //         "xray:GetTraceGraph",
        //         "xray:GetTraceSummaries",
        //         "xray:GetGroups",
        //         "xray:GetGroup",
        //         "xray:ListTagsForResource",
        //         "xray:GetTimeSeriesServiceStatistics",
        //         "xray:GetInsightSummaries",
        //         "xray:GetInsight",
        //         "xray:GetInsightEvents",
        //         "xray:GetInsightImpactGraph",
        //         "ssm:GetParameter"
        //     ],
        //     resources: ["*"]
        // };

        // Props for cross-account trust role in PROD2 account to trust AMG from MON account, inorder to access PROD2's CloudWatch data
        cwAssumeRoleName = "CWAccessForTrustedAMGRole";
        const CWAccessRoleStackProps: CreateIAMRoleNestedStackProps = {
            roleName: cwAssumeRoleName,
            trustArn: amgWorkspaceIAMRoleARN!,
            statement: getCWAccessPolicyDocument()
        };
        // const CWAccessRoleStackProps: CreateIAMRoleNestedStackProps = {
        //     roleName: cwAssumeRoleName,
        //     trustArn: amgWorkspaceIAMRoleARN!,
        //     actions: [
        //         "cloudwatch:DescribeAlarmsForMetric",
        //         "cloudwatch:DescribeAlarmHistory",
        //         "cloudwatch:DescribeAlarms",
        //         "cloudwatch:ListMetrics",
        //         "cloudwatch:GetMetricStatistics",
        //         "cloudwatch:GetMetricData",
        //         "logs:DescribeLogGroups",
        //         "logs:GetLogGroupFields",
        //         "logs:StartQuery",
        //         "logs:StopQuery",
        //         "logs:GetQueryResults",
        //         "logs:GetLogEvents",
        //         "ec2:DescribeTags",
        //         "ec2:DescribeInstances",
        //         "ec2:DescribeRegions",
        //         "tag:GetResources",
        //         "xray:PutTraceSegments",
        //         "xray:PutTelemetryRecords",
        //         "xray:GetSamplingRules",
        //         "xray:GetSamplingTargets",
        //         "xray:GetSamplingStatisticSummaries",
        //         "xray:BatchGetTraces",
        //         "xray:GetServiceGraph",
        //         "xray:GetTraceGraph",
        //         "xray:GetTraceSummaries",
        //         "xray:GetGroups",
        //         "xray:GetGroup",
        //         "xray:ListTagsForResource",
        //         "xray:GetTimeSeriesServiceStatistics",
        //         "xray:GetInsightSummaries",
        //         "xray:GetInsight",
        //         "xray:GetInsightEvents",
        //         "xray:GetInsightImpactGraph",
        //         "ssm:GetParameter"
        //     ],
        //     resources: ["*"]
        // };

        // creating constructs
        const ampConstruct = new AmpMonitoringConstruct();
        const blueprintAmp = ampConstruct.create(scope, context.prodEnv1.account, context.prodEnv1.region);
        const blueprintCloudWatch = new CloudWatchMonitoringConstruct().create(scope, context.prodEnv2.account, context.prodEnv2.region, PROD2_ENV_ID);
        const blueprintAmg = new GrafanaOperatorConstruct().create(scope, context.monitoringEnv.account, context.monitoringEnv.region);

        // Argo configuration per environment
        // CHANGE ME FINALLY
        // const prodArgoAddonConfig = createArgoAddonConfig(
        //     'https://github.com/aws-observability/aws-observability-accelerator.git',
        //     'artifacts/sample-apps/envs/prod',
        //     'main',
        //     'public'
        // );
        const prodArgoAddonConfig = createArgoAddonConfig(
            'https://github.com/iamprakkie/aws-observability-accelerator.git',
            'artifacts/sample-apps/envs/prod',
            'artifacts',
            'public'
        );

        // CHANGE ME FINALLY HERE AS WELL AS IN APP'S VALUES.YAML
        // const grafanaOperatorArgoAddonConfig = createGOArgoAddonConfig(
        //     'https://github.com/aws-observability/aws-observability-accelerator.git',
        //     'artifacts/sample-apps/grafana-operator-app',
        //     'main',
        //     'private'
        // );
        const grafanaOperatorArgoAddonConfig = createGOArgoAddonConfig(
            'https://github.com/iamprakkie/aws-observability-accelerator.git',
            'artifacts/sample-apps/grafana-operator-app',
            'artifacts',
            'private'
        );

        const AmgIamSetupStackProps: AmgIamSetupStackProps = {
            roleArn: amgWorkspaceIAMRoleARN,
            accounts: [context.prodEnv1.account!, context.prodEnv2.account!]
        };

        // get CodePipeline Source Github info
        const pipelineSrcInfo = JSON.parse(await getSSMSecureString('/cdk-accelerator/pipeline-git-info',this.pipelineRegion))['pipelineSource'];
        const gitOwner = pipelineSrcInfo.gitOwner;
        const gitRepositoryName = pipelineSrcInfo.gitRepoName;
        const gitBranch = pipelineSrcInfo.gitBranch;

        const pipeline = blueprints.CodePipelineStack.builder()
            .application("npx ts-node bin/multi-acc-new-eks-mixed-observability.ts")
            .name("multi-account-COA-pipeline")
            .owner(gitOwner)
            .codeBuildPolicies([iam.PolicyStatement.fromJson(getCodeBuildPolicyDocument())])
            // .codeBuildPolicies([
            //     new iam.PolicyStatement({
            //         resources: ["*"],
            //         actions: [
            //             "sts:AssumeRole",
            //             "secretsmanager:GetSecretValue",
            //             "secretsmanager:DescribeSecret",
            //             "cloudformation:*",
            //             "ssm:GetParameter",
            //             "ssm:PutParameter",
            //             "ssm:DescribeParameter"
            //         ]
            //     })
            // ])
            .repository({
                repoUrl: gitRepositoryName,
                credentialsSecretName: 'github-token',
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
                .addOns(grafanaOperatorArgoAddonConfig)
        };

        const ampStage: blueprints.StackStage = {
            id: PROD1_ENV_ID,
            stackBuilder: blueprintAmp
                .name(PROD1_ENV_ID)
                .clone(context.prodEnv1.region, context.prodEnv1.account)
                .version('auto')
                .addOns(new blueprints.NestedStackAddOn({
                    builder: CreateIAMRoleNestedStack.builder(AMPAccessRoleStackProps),
                    id: "amp-ds-trustrole-nested-stack"
                }))
                .addOns(prodArgoAddonConfig)
        };

        const cwStage: blueprints.StackStage = {
            id: PROD2_ENV_ID,
            stackBuilder: blueprintCloudWatch
                .name(PROD2_ENV_ID)
                .clone(context.prodEnv2.region, context.prodEnv2.account)
                .addOns(new blueprints.NestedStackAddOn({
                    // builder: CloudWatchIamSetupStack.builder("CWAccessForTrustedAMGRole", amgWorkspaceIAMRoleARN!),
                    builder: CreateIAMRoleNestedStack.builder(CWAccessRoleStackProps),
                    id: "cloudwatch-iam-nested-stack"
                }))
                .addOns(prodArgoAddonConfig)
        };

        pipeline.wave({
            id: "multi-acc-stage-01",
            stages: [ampStage, cwStage]
        });

        // adding monitoring env setup as separate stage
        pipeline.stage(monStage);

        pipeline.build(scope, "multi-account-COA-pipeline", {
            env: context.pipelineEnv
        });

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
        };
    } else {

        ArgoCDAddOnProps = {
            bootstrapRepo: {
                repoUrl: repoUrl,
                path: path,
                targetRevision: branch,
                credentialsSecretName: 'github-ssh-key', // for access to private repo. This needs SecretStoreAddOn added to your cluster. Ensure github-ssh-key secret exists in pipeline account at COA_REGION
                credentialsType: 'SSH',
            },
        };
    }
    return new blueprints.ArgoCDAddOn(ArgoCDAddOnProps);
}


function createGOArgoAddonConfig(repoUrl: string, path: string, branch?: string, repoType?: repoTypeValues): blueprints.ArgoCDAddOn {

    branch = branch! || 'main';
    repoType = repoType! || 'public';

    const ampAssumeRoleArn = `arn:aws:iam::${ampAccount}:role/${ampAssumeRoleName}`;
    const cwAssumeRoleArn = `arn:aws:iam::${cwAccount}:role/${cwAssumeRoleName}`;

    const ampEndpointURL = "UPDATE_ME_WITH_AMP_ENDPOINT_URL";

    let ArgoCDAddOnProps: blueprints.ArgoCDAddOnProps;

    if (repoType.toLocaleLowerCase() === 'public') {
        ArgoCDAddOnProps = {
            bootstrapRepo: {
                repoUrl: repoUrl,
                path: path,
                targetRevision: branch,
            },
        };
    } else {

        ArgoCDAddOnProps = {
            bootstrapRepo: {
                repoUrl: repoUrl,
                path: path,
                targetRevision: branch,
                credentialsSecretName: 'github-ssh-key', // for access to private repo. This needs SecretStoreAddOn added to your cluster. Ensure github-ssh-key secret exists in pipeline account at COA_REGION
                credentialsType: 'SSH',
            },
        };
    }

    ArgoCDAddOnProps.bootstrapValues = {
        AMP_ASSUME_ROLE_ARN: ampAssumeRoleArn,
        AMP_AWS_REGION: ampRegion,
        CW_ASSUME_ROLE_ARN: cwAssumeRoleArn,
        CW_AWS_REGION: cwRegion,
        AMP_ENDPOINT_URL: ampEndpointURL,
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