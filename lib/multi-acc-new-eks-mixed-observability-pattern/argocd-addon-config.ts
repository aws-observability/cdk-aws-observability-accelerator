import * as blueprints from '@aws-quickstart/eks-blueprints';

type repoTypeValues = 'public' | 'private';

export interface GrafanaOperatorProps {
    ampAccount: string;
    ampRegion: string;
    cwAccount: string;
    cwRegion: string;
    ampAssumeRoleName: string;
    cwAssumeRoleName: string;
    amgWorkspaceUrl: string;
    clusterDashUrl: string;
    kubeletDashUrl: string;
    namespaceWorkloadsDashUrl: string;
    nodeExporterDashUrl: string;
    nodesDashUrl: string;
    workloadsDashUrl: string;

}

export interface ArgoCDAddOnConfigProps {
    repoUrl: string;
    path: string;
    branch?: string
    repoType?: repoTypeValues
    goProps?: GrafanaOperatorProps
}

export function createArgoCDAddonConfig(props: ArgoCDAddOnConfigProps) : blueprints.ArgoCDAddOn {
    props.branch = props.branch! || 'main';
    props.repoType = props.repoType! || 'public';

    let ArgoCDAddOnProps: blueprints.ArgoCDAddOnProps;

    if (props.repoType.toLocaleLowerCase() === 'public') {
        ArgoCDAddOnProps = {
            bootstrapRepo: {
                repoUrl: props.repoUrl,
                path: props.path,
                targetRevision: props.branch,
            },
        };
    } else {

        ArgoCDAddOnProps = {
            bootstrapRepo: {
                repoUrl: props.repoUrl,
                path: props.path,
                targetRevision: props.branch,
                credentialsSecretName: 'github-ssh-key', // for access to private repo. This needs SecretStoreAddOn added to your cluster. Ensure github-ssh-key secret exists in pipeline account at COA_REGION
                credentialsType: 'SSH',
            },
        };
    }

    if (props.goProps !== undefined) {
        const ampAssumeRoleArn = `arn:aws:iam::${props.goProps.ampAccount}:role/${props.goProps.ampAssumeRoleName}`;
        const cwAssumeRoleArn = `arn:aws:iam::${props.goProps.cwAccount}:role/${props.goProps.cwAssumeRoleName}`;
        const ampEndpointURL = "UPDATE_ME_WITH_AMP_ENDPOINT_URL";

        ArgoCDAddOnProps.bootstrapValues = {
            AMP_ASSUME_ROLE_ARN: ampAssumeRoleArn,
            AMP_AWS_REGION: props.goProps.ampRegion,
            CW_ASSUME_ROLE_ARN: cwAssumeRoleArn,
            CW_AWS_REGION: props.goProps.cwRegion,
            AMP_ENDPOINT_URL: ampEndpointURL,
            AMG_ENDPOINT_URL: props.goProps.amgWorkspaceUrl,
            GRAFANA_CLUSTER_DASH_URL: props.goProps.clusterDashUrl,
            GRAFANA_KUBELET_DASH_URL: props.goProps.kubeletDashUrl,
            GRAFANA_NSWRKLDS_DASH_URL: props.goProps.namespaceWorkloadsDashUrl,
            GRAFANA_NODEEXP_DASH_URL: props.goProps.nodeExporterDashUrl,
            GRAFANA_NODES_DASH_URL: props.goProps.nodesDashUrl,
            GRAFANA_WORKLOADS_DASH_URL: props.goProps.workloadsDashUrl
        };

        // By default argocd-server is not publicaly exposed. uncomment this section, if you need to expose using ALB
        // ArgoCDAddOnProps.values = {
        //     server: {
        //         service: {
        //             type: 'LoadBalancer'
        //         }
        //     }
        // };
    }

    return new blueprints.ArgoCDAddOn(ArgoCDAddOnProps);
}