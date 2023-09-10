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

type repoTypeValues = 'public' | 'private';

let clusterDashUrl: string;
let kubeletDashUrl: string;
let namespaceWorkloadsDashUrl: string;
let nodeExporterDashUrl: string;
let nodesDashUrl: string;
let workloadsDashUrl: string;

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

      // All Grafana Dashboard URLs from `cdk.json` if present
      clusterDashUrl = utils.valueFromContext(scope, "cluster.dashboard.url", undefined);
      kubeletDashUrl = utils.valueFromContext(scope, "kubelet.dashboard.url", undefined);
      namespaceWorkloadsDashUrl = utils.valueFromContext(scope, "namespaceworkloads.dashboard.url", undefined);
      nodeExporterDashUrl = utils.valueFromContext(scope, "nodeexporter.dashboard.url", undefined);
      nodesDashUrl = utils.valueFromContext(scope, "nodes.dashboard.url", undefined);
      workloadsDashUrl = utils.valueFromContext(scope, "workloads.dashboard.url", undefined);        

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
            roleName: "amgWorkspaceIamRole",
            accounts: [context.prodEnv1.account!, context.prodEnv2.account!]
        };

        const AmgIamRoleArn = `arn:aws:iam::${context.monitoringEnv.account}:role/${AmgIamSetupStackProps.roleName}`

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
        spec: {
            syncPolicy: {}
        },
        AMP_ASSUME_ROLE_ARN: ampAssumeRoleArn,
        AMP_AWS_REGION: ampRegion,
        CW_ASSUME_ROLE_ARN: cwAssumeRoleArn,
        CW_AWS_REGION: cwRegion,        
        AMP_ENDPOINT_URL: 'UPDATE_ME_WITH_AMP_ENDPOINT_URL',
        AMG_ENDPOINT_URL: 'UPDATE_ME_WITH_AMG_ENDPOINT_URL_STARTING_WITH_HTTPS',
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