import * as blueprints from '@aws-quickstart/eks-blueprints';
import { utils } from '@aws-quickstart/eks-blueprints';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import AmpMonitoringConstruct from './amp-monitoring';
import CloudWatchMonitoringConstruct from './cloudwatch-monitoring';
import GrafanaOperatorConstruct from "./GrafanaOperatorConstruct";
import { AmgIamSetupStack, AmgIamSetupStackProps } from './amg-iam-setup';
import { AmpIamSetupStack } from './amp-iam-setup';
import { CloudWatchIamSetupStack } from './cloudwatch-iam-setup';

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
    // Populate Context Defaults for all the accounts
    const cdkContext = JSON.parse(await blueprints.utils.getSecretValue('cdk-context', region))['context'] as PipelineMultiEnvMonitoringProps;
    logger.debug(`Retrieved CDK context ${JSON.stringify(cdkContext)}`);
    return cdkContext;
}

export interface PipelineMultiEnvMonitoringProps {
    /**
     * Production workload environment (account/region) #1 
     */
    prodEnv1: cdk.Environment;

    /**
     * Production workload environment (account/region) #2
     */
    prodEnv2: cdk.Environment;

    /**
     * Environment (account/region) where pipeline will be running (generally referred to as CICD account)
     */
    pipelineEnv: cdk.Environment;

    /**
     * Environment (account/region) where monitoring dashboards will be configured.
     */
    monitoringEnv: cdk.Environment;
}

/**
 * Main multi-account monitoring pipeline.
 */
export class PipelineMultiEnvMonitoring {

    readonly inPipelineRegion = process.env.COA_PIPELINE_REGION! || process.env.CDK_DEFAULT_REGION!;
    readonly inPipelineGitOwner = process.env.COA_PIPELINE_GIT_OWNER;

    async getSSMSecureString(scope: Construct, parameterName: string): Promise<string> { 
        const ssmValue = ssm.StringParameter.fromSecureStringParameterAttributes(scope, 'SSMParameter', {
            parameterName: parameterName,
          });
        return ssmValue.stringValue;
    }
    
    async buildAsync(scope: Construct) {

        // Checks for Git Owner
        if (!this.inPipelineRegion) {
            logger.debug("ERROR: COA_PIPELINE_REGION or CDK_DEFAULT_REGION environment variable is not defined.");
            process.exit(1);
        }

        if (!this.inPipelineGitOwner) {
            logger.debug("ERROR: COA_PIPELINE_GIT_OWNER environment variable is not defined.");
            process.exit(1); 
        }        

        process.exit(1);
        const context = await populateAccountWithContextDefaults(this.inPipelineRegion);
        // environments IDs consts
        const PROD1_ENV_ID = `coa-eks-prod1-${context.prodEnv1.region}`;
        const PROD2_ENV_ID = `coa-eks-prod2-${context.prodEnv2.region}`;
        const MON_ENV_ID = `coa-cntrl-mon-${context.monitoringEnv.region}`;

        let parsedSSMValue: string | any;

        // All Grafana Dashboard URLs from `cdk.json` if present
        clusterDashUrl = utils.valueFromContext(scope, "cluster.dashboard.url", undefined);
        kubeletDashUrl = utils.valueFromContext(scope, "kubelet.dashboard.url", undefined);
        namespaceWorkloadsDashUrl = utils.valueFromContext(scope, "namespaceworkloads.dashboard.url", undefined);
        nodeExporterDashUrl = utils.valueFromContext(scope, "nodeexporter.dashboard.url", undefined);
        nodesDashUrl = utils.valueFromContext(scope, "nodes.dashboard.url", undefined);
        workloadsDashUrl = utils.valueFromContext(scope, "workloads.dashboard.url", undefined);
        
        const amgSSMParameter = '/cdk-accelerator/amg-info'; // Replace with your parameter name

        this.getSSMSecureString(scope, amgSSMParameter).then((ssmValue) => {
            parsedSSMValue = JSON.parse(ssmValue)['amg'];
            logger.debug(`Retrieved SecureString ${amgSSMParameter}:: ${JSON.stringify(ssmValue)}`);
        });

        amgWorkspaceUrl = parsedSSMValue.workspaceURL;
        const amgWorkspaceIAMRoleARN = parsedSSMValue.workspaceIAMRoleARN;

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

        // const { gitOwner, gitRepositoryName } = await getRepositoryData();
        // const gitOwner = 'aws-samples'; 
        // CHANGE ME FINALLY
        const gitOwner = 'Prakkie'; 
        const gitRepositoryName = 'cdk-aws-observability-accelerator';

        const AmgIamSetupStackProps: AmgIamSetupStackProps = {
            // roleName: "amgWorkspaceIamRole",
            roleArn: amgWorkspaceIAMRoleARN,
            accounts: [context.prodEnv1.account!, context.prodEnv2.account!]
        };

        blueprints.CodePipelineStack.builder()
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
                        "cloudformation:*"
                    ]
                })
            ])
            .repository({
                repoUrl: gitRepositoryName,
                credentialsSecretName: 'github-token',
                // targetRevision: 'main',
                // UPDATE ME FINALLY
                targetRevision: 'multi-account-COA', 
            })
            .enableCrossAccountKeys()
            .wave({
                id: "multi-acc-stages",
                stages: [
                    {
                        id: PROD1_ENV_ID,
                        stackBuilder: blueprintAmp
                            .name(PROD1_ENV_ID)                        
                            .clone(context.prodEnv1.region, context.prodEnv1.account)
                            .version('auto')
                            .addOns(new blueprints.NestedStackAddOn({
                                builder: AmpIamSetupStack.builder("ampPrometheusDataSourceRole", amgWorkspaceIAMRoleARN!),
                                id: "amp-iam-nested-stack"
                            }))
                            .addOns(
                                prodArgoAddonConfig,
                            )
                    },
                    {
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
                    },
                    {
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
                    },       
                ],
            })
            .build(scope, "multi-account-central-pipeline", {
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

    const ampAssumeRoleArn = `arn:aws:iam::${ampAccount}:role/ampPrometheusDataSourceRole`
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