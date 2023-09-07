import * as blueprints from '@aws-quickstart/eks-blueprints';
import { utils } from '@aws-quickstart/eks-blueprints';
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
        const MON_ENV_ID = `coa-cntrl-mon-${context.monitoringEnv.region}`;

        const ampConstruct = new AmpMonitoringConstruct();
        const blueprintAmp = ampConstruct.create(scope, context.prodEnv1.account, context.prodEnv1.region);
        const blueprintCloudWatch = new CloudWatchMonitoringConstruct().create(scope, context.prodEnv2.account, context.prodEnv2.region, PROD2_ENV_ID);
        const blueprintAmg = new GrafanaOperatorConstruct().create(scope, context.monitoringEnv.account, context.monitoringEnv.region);

        // Argo configuration per environment
        const prodArgoAddonConfig = createArgoAddonConfig(context.prodEnv1.account, context.prodEnv1.region, 'https://github.com/aws-samples/eks-blueprints-workloads.git','envs/prod','main','public');
        const grafanaOperatorArgoAddonConfig = createArgoAddonConfig(context.prodEnv1.account, context.monitoringEnv.region, 'https://github.com/iamprakkie/one-observability-demo.git','grafana-operator-chart','main','private');

        // const { gitOwner, gitRepositoryName } = await getRepositoryData();
        // const gitOwner = 'aws-samples'; 
        const gitOwner = 'Prakkie'; 
        // const gitRepositoryName = 'cdk-eks-blueprints-patterns';
        const gitRepositoryName = 'cdk-aws-observability-accelerator';

        const AmgIamSetupStackProps: AmgIamSetupStackProps = {
            roleName: "amgWorkspaceIamRole",
            accounts: [context.prodEnv1.account!, context.prodEnv2.account!]
        };

        const AmgIamRoleArn = `arn:aws:iam::${context.prodEnv1.account}:role/${AmgIamSetupStackProps.roleName}`

        const pline = blueprints.CodePipelineStack.builder()
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
                                builder: AmpIamSetupStack.builder("ampPrometheusDataSourceRole", AmgIamRoleArn!),
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
                                builder: CloudWatchIamSetupStack.builder("cloudwatchDataSourceRole", AmgIamRoleArn!),
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

type repoTypeValues = 'public' | 'private';

function createArgoAddonConfig(ampAccount: string | undefined, amgRegion: string | undefined, repoUrl: string, path: string, branch?: string, repoType?: repoTypeValues): blueprints.ArgoCDAddOn {

    branch = branch! || 'main';
    repoType = repoType! || 'public';

    const amgEndpointUrl = process.env.COA_AMG_ENDPOINT_URL! || "UPDATE_ME_WITH_AMG_ENDPOINT_URL_STARTING_WITH_HTTPS";

    let ArgoCDAddOnProps: blueprints.ArgoCDAddOnProps;

    if (repoType.toLocaleLowerCase() === 'public') {
        ArgoCDAddOnProps = {
            bootstrapRepo: {
                repoUrl: repoUrl,
                path: path,
                targetRevision: branch,
            },
            bootstrapValues: {
                "AMG_AWS_REGION": amgRegion,
                "AMP_ACCOUNT_ID": ampAccount,
                "AMP_ENDPOINT_URL": "UPDATE_ME_WITH_AMP_ENDPOINT_URL",
                "AMG_ENDPOINT_URL": amgEndpointUrl,
                // "GRAFANA_NODEEXP_DASH_URL": "https://raw.githubusercontent.com/aws-samples/one-observability-demo/main/grafana-dashboards/nodeexporter-nodes.json",
                "GRAFANA_CLUSTER_DASH_URL" : "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/cluster.json",
                "GRAFANA_KUBELET_DASH_URL" : "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/kubelet.json",
                "GRAFANA_NSWRKLDS_DASH_URL" : "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/namespace-workloads.json",
                "GRAFANA_NODEEXP_DASH_URL" : "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/nodeexporter-nodes.json",
                "GRAFANA_NODES_DASH_URL" : "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/nodes.json",
                "GRAFANA_WORKLOADS_DASH_URL" : "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/workloads.json"        
            },      
            // values: {
            //     server: {  // By default argocd-server is not publicaly exposed. uncomment this section, if you need to expose using ALB
            //         service: {
            //             type: 'LoadBalancer'
            //         }
            //     }
            // },            
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
            bootstrapValues: {
                "AMG_AWS_REGION": amgRegion,
                "AMP_ACCOUNT_ID": ampAccount,
                "AMP_ENDPOINT_URL": "UPDATE_ME_WITH_AMP_ENDPOINT_URL",
                "AMG_ENDPOINT_URL": amgEndpointUrl,
                // "GRAFANA_NODEEXP_DASH_URL": "https://raw.githubusercontent.com/aws-samples/one-observability-demo/main/grafana-dashboards/nodeexporter-nodes.json",
                "GRAFANA_CLUSTER_DASH_URL" : "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/cluster.json",
                "GRAFANA_KUBELET_DASH_URL" : "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/kubelet.json",
                "GRAFANA_NSWRKLDS_DASH_URL" : "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/namespace-workloads.json",
                "GRAFANA_NODEEXP_DASH_URL" : "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/nodeexporter-nodes.json",
                "GRAFANA_NODES_DASH_URL" : "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/nodes.json",
                "GRAFANA_WORKLOADS_DASH_URL" : "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/infrastructure/workloads.json"
            },
            // values: {
            //     server: {  // By default argocd-server is not publicaly exposed. uncomment this section, if you need to expose using ALB
            //         service: {
            //             type: 'LoadBalancer'
            //         }
            //     }
            // },                        
        }        
    }

    return new blueprints.ArgoCDAddOn(ArgoCDAddOnProps);
}