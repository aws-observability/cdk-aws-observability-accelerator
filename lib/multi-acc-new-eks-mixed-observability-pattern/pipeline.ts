import * as blueprints from '@aws-quickstart/eks-blueprints';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import AmpMonitoringConstruct from './amp-monitoring';
import CloudWatchMonitoringConstruct from './cloudwatch-monitoring';
import GrafanaOperatorConstruct from "./GrafanaOperatorConstruct";
import { AmgIamSetupStack, AmgIamSetupStackProps } from './amg-iam-setup';
import { AmpIamSetupStack } from './amp-iam-setup';
import { CloudWatchIamSetupStack } from './cloudwatch-iam-setup';

const logger = blueprints.utils.logger;

/**
 * Function relies on a secret called "cdk-context" defined in the us-east-1 region in pipeline account. Its a MANDATORY STEP.
 * @returns 
 */
export async function populateAccountWithContextDefaults(): Promise<PipelineMultiEnvMonitoringProps> {
    // Populate Context Defaults for all the accounts
    const cdkContext = JSON.parse(await blueprints.utils.getSecretValue('cdk-context', 'us-east-1'))['context'] as PipelineMultiEnvMonitoringProps;
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

    async buildAsync(scope: Construct) {
        const context = await populateAccountWithContextDefaults();
        // environments IDs consts
        const PROD1_ENV_ID = `coa-eks-prod1-${context.prodEnv1.region}`;
        const PROD2_ENV_ID = `coa-eks-prod2-${context.prodEnv2.region}`;
        const MON_ENV_ID = `central-monitoring-${context.monitoringEnv.region}`;

        const blueprintAmp = new AmpMonitoringConstruct().create(scope, context.prodEnv1.account, context.prodEnv1.region);
        const blueprintCloudWatch = new CloudWatchMonitoringConstruct().create(scope, context.prodEnv2.account, context.prodEnv2.region, PROD2_ENV_ID);
        const blueprintAmg = new GrafanaOperatorConstruct().create(scope, context.monitoringEnv.account, context.monitoringEnv.region);

        // Argo configuration per environment
        const prodArgoAddonConfig = createArgoAddonConfig('prod', 'https://github.com/aws-samples/eks-blueprints-workloads.git','envs/prod','main');
        const grafanaOperatorArgoAddonConfig = createArgoAddonConfig('monitoring','https://github.com/iamprakkie/one-observability-demo.git','grafana-operator-chart','main');

        // const { gitOwner, gitRepositoryName } = await getRepositoryData();
        // const gitOwner = 'aws-samples'; 
        const gitOwner = 'Prakkie'; 
        // const gitRepositoryName = 'cdk-eks-blueprints-patterns';
        const gitRepositoryName = 'cdk-aws-observability-accelerator';

        const AmgIamSetupStackProps: AmgIamSetupStackProps = {
            roleName: "amgWorkspaceIamRole",
            accounts: [context.prodEnv1.account!, context.prodEnv2.account!]
        };

        blueprints.CodePipelineStack.builder()
            .application("npx ts-node bin/multi-acc-new-eks-mixed-observability.ts")
            .name("multi-account-central-pipeline")
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
                targetRevision: 'multi-account-COA',
            })
            .enableCrossAccountKeys()
            .wave({
                id: "prod-test",
                stages: [
                    {
                        id: PROD1_ENV_ID,
                        stackBuilder: blueprintAmp
                            .name(PROD1_ENV_ID)                        
                            .clone(context.prodEnv1.region, context.prodEnv1.account)
                            .version('auto')
                            .addOns(new blueprints.NestedStackAddOn({
                                builder: AmpIamSetupStack.builder("ampPrometheusDataSourceRole", context.monitoringEnv.account!),
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
                                builder: CloudWatchIamSetupStack.builder("cloudwatchDataSourceRole", context.monitoringEnv.account!),
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
                    // {
                    //     id: MON_ENV_ID,
                    //     stackBuilder: <blueprints.StackBuilder>{
                    //         build(scope: Construct): cdk.Stack {
                    //             return new AmgIamSetupStack(scope, "amg-iam-setup", amgIamSetupStackProps);
                    //         }
                    //     }
                    // },
                    // grafanaOperatorArgoAddonConfig, // ArgoCD config for grafana-operator             
                ],
            })
            .build(scope, "multi-account-central-pipeline", {
                env: context.pipelineEnv
            });
    }
}

function createArgoAddonConfig(environment: string, repoUrl: string, path: string, branch: string): blueprints.ArgoCDAddOn {
    return new blueprints.ArgoCDAddOn(
        {
            bootstrapRepo: {
                repoUrl: repoUrl,
                path: path,
                targetRevision: branch,
                credentialsSecretName: 'github-ssh-key', // for access to private repo. This needs SecretStoreAddOn added to your cluster. Ensure github-ssh-key secret exists in pipeline account at COA_REGION
                credentialsType: 'SSH',
            },
            // values: {
            //     server: {  // By default argocd-server is not publicaly exposed. uncomment this section, if you need to expose using ALB
            //         service: {
            //             type: 'LoadBalancer'
            //         }
            //     }
            // },
            // bootstrapValues: {
            //     "region": "us-west-2"
            // },
        }
    );
}