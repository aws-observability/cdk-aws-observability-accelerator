import * as blueprints from '@aws-quickstart/eks-blueprints';
import { utils } from '@aws-quickstart/eks-blueprints';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import AmpMonitoringConstruct from './amp-monitoring';
import CloudWatchMonitoringConstruct from './cloudwatch-monitoring';
import GrafanaOperatorConstruct from "./central-monitoring";
import { AmgIamSetupStack, AmgIamSetupStackProps } from './amg-iam-setup';
import { getAMPAccessPolicyDocument } from './amp-access-policy';
import { getCWAccessPolicyDocument } from './cw-access-policy';
import { getCodeBuildPolicyDocument } from './codebuild-policy';
import { CreateIAMRoleNestedStack, CreateIAMRoleNestedStackProps } from './create-iam-role';
import { getSSMSecureString } from './get-ssm-securestring';
import { createArgoCDAddonConfig, ArgoCDAddOnConfigProps, GrafanaOperatorProps } from './argocd-addon-config';

const logger = blueprints.utils.logger;

// Function relies on a secret called "cdk-context" defined in COA_PIPELINE_REGION region in pipeline account. Its a MANDATORY STEP.
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

        // creating constructs
        const ampConstruct = new AmpMonitoringConstruct();
        const blueprintAmp = ampConstruct.create(scope, context.prodEnv1.account, context.prodEnv1.region);
        const blueprintCloudWatch = new CloudWatchMonitoringConstruct().create(scope, context.prodEnv2.account, context.prodEnv2.region, PROD2_ENV_ID);
        const blueprintAmg = new GrafanaOperatorConstruct().create(scope, context.monitoringEnv.account, context.monitoringEnv.region);

        // Get AMG info from SSM SecureString
        const amgInfo = JSON.parse(await getSSMSecureString('/cdk-accelerator/amg-info',this.pipelineRegion))['amg'];
        const amgWorkspaceIAMRoleARN = amgInfo.workspaceIAMRoleARN;

        const AmgIamSetupStackProps: AmgIamSetupStackProps = {
            roleArn: amgWorkspaceIAMRoleARN,
            accounts: [context.prodEnv1.account!, context.prodEnv2.account!]
        };

        // get CodePipeline Source Github info
        const pipelineSrcInfo = JSON.parse(await getSSMSecureString('/cdk-accelerator/pipeline-git-info',this.pipelineRegion))['pipelineSource'];
        const gitOwner = pipelineSrcInfo.gitOwner;
        const gitRepositoryName = pipelineSrcInfo.gitRepoName;
        const gitBranch = pipelineSrcInfo.gitBranch;

        let codeBuildPolicies: unknown;
        getCodeBuildPolicyDocument().forEach((statement) => {
            codeBuildPolicies = iam.PolicyStatement.fromJson(statement);
        });

        const pipeline = blueprints.CodePipelineStack.builder()
            .application("npx ts-node bin/multi-acc-new-eks-mixed-observability.ts")
            .name("multi-account-COA-pipeline")
            .owner(gitOwner)
            .codeBuildPolicies([codeBuildPolicies as iam.PolicyStatement])
            .repository({
                repoUrl: gitRepositoryName,
                credentialsSecretName: 'github-token',
                targetRevision: gitBranch,
            })
            .enableCrossAccountKeys();

        // Argo configuration for prod1 and prod2
        const prodArgoCDAddOnConfigProps: ArgoCDAddOnConfigProps = {
            repoUrl: 'https://github.com/aws-observability/aws-observability-accelerator.git',
            path: 'artifacts/argocd-apps/sample-apps/envs/prod',
            branch: 'main',
            repoType: 'public'
        };
        const prodArgoCDAddOnConfig = createArgoCDAddonConfig(prodArgoCDAddOnConfigProps);

        // Props for cross-account trust role in PROD1 account to trust AMG from MON account, inorder to access PROD1's AMP.
        const ampAssumeRoleName = "AMPAccessForTrustedAMGRole";
        const AMPAccessRoleStackProps: CreateIAMRoleNestedStackProps = {
            roleName: ampAssumeRoleName!,
            trustArn: amgWorkspaceIAMRoleARN!,
            policyDocument: getAMPAccessPolicyDocument()
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
                .addOns(prodArgoCDAddOnConfig)
        };

        // Props for cross-account trust role in PROD2 account to trust AMG from MON account, inorder to access PROD2's CloudWatch data
        const cwAssumeRoleName = "CWAccessForTrustedAMGRole";
        const CWAccessRoleStackProps: CreateIAMRoleNestedStackProps = {
            roleName: cwAssumeRoleName,
            trustArn: amgWorkspaceIAMRoleARN!,
            policyDocument: getCWAccessPolicyDocument()
        };

        const cwStage: blueprints.StackStage = {
            id: PROD2_ENV_ID,
            stackBuilder: blueprintCloudWatch
                .name(PROD2_ENV_ID)
                .clone(context.prodEnv2.region, context.prodEnv2.account)
                .addOns(new blueprints.NestedStackAddOn({
                    builder: CreateIAMRoleNestedStack.builder(CWAccessRoleStackProps),
                    id: "cloudwatch-iam-nested-stack"
                }))
                .addOns(prodArgoCDAddOnConfig)
        };

        pipeline.wave({
            id: "multi-acc-stage-01",
            stages: [ampStage, cwStage]
        });

        // ArgoCD configuration for monitoringEnv
        const goProps: GrafanaOperatorProps = {
            ampAccount: context.prodEnv1.account as string,
            ampRegion: context.prodEnv1.region as string,
            cwAccount: context.prodEnv2.account as string,
            cwRegion: context.prodEnv2.region as string,
            ampAssumeRoleName: ampAssumeRoleName,
            cwAssumeRoleName: cwAssumeRoleName,
            amgWorkspaceUrl: amgInfo.workspaceURL,
            clusterDashUrl: utils.valueFromContext(scope, "cluster.dashboard.url", undefined),
            kubeletDashUrl: utils.valueFromContext(scope, "kubelet.dashboard.url", undefined),
            namespaceWorkloadsDashUrl: utils.valueFromContext(scope, "namespaceworkloads.dashboard.url", undefined),
            nodeExporterDashUrl: utils.valueFromContext(scope, "nodeexporter.dashboard.url", undefined),
            nodesDashUrl: utils.valueFromContext(scope, "nodes.dashboard.url", undefined),
            workloadsDashUrl: utils.valueFromContext(scope, "workloads.dashboard.url", undefined)
        };
        const monArgoCDAddOnConfigProps: ArgoCDAddOnConfigProps = {
            repoUrl: 'https://github.com/aws-observability/aws-observability-accelerator.git',
            path: 'artifacts/argocd-apps/grafana-operator-app',
            branch: 'main',
            repoType: 'public',
            goProps: goProps
        };

        const goArgoCDAddOnConfig = createArgoCDAddonConfig(monArgoCDAddOnConfigProps);

        const monStage: blueprints.StackStage = {
            id: MON_ENV_ID,
            stackBuilder: blueprintAmg
                .name(MON_ENV_ID)
                .clone(context.monitoringEnv.region, context.monitoringEnv.account)
                .addOns(new blueprints.NestedStackAddOn({
                    builder: AmgIamSetupStack.builder(AmgIamSetupStackProps),
                    id: "amg-iam-nested-stack"
                }))
                .addOns(goArgoCDAddOnConfig)
        };

        // adding monitoring env setup as separate stage
        pipeline.stage(monStage);

        pipeline.build(scope, "multi-account-COA-pipeline", {
            env: context.pipelineEnv
        });

    }
}