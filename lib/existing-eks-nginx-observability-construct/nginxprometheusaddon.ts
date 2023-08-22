import * as blueprints from '@aws-quickstart/eks-blueprints';
import * as eks from "aws-cdk-lib/aws-eks";
import * as amp from 'aws-cdk-lib/aws-aps';
import * as fs from 'fs';

import { Construct } from 'constructs';
import { dependable } from '@aws-quickstart/eks-blueprints/dist/utils';

/**
 * Configuration options for add-on.
 */
export interface NginxPrometheusAddonProps {
    ampWorkspaceArn: string;
    grafanaDashboardUrl?: string | undefined;
}

export class NginxPrometheusAddon implements blueprints.ClusterAddOn {
    readonly nginxPrometheusAddonProps: NginxPrometheusAddonProps;
    constructor(props: NginxPrometheusAddonProps) {
        this.nginxPrometheusAddonProps = props;
    }
    @dependable(blueprints.addons.ExternalsSecretsAddOn.name)
    deploy(clusterInfo: blueprints.ClusterInfo): void | Promise<Construct> {
        const cluster = clusterInfo.cluster;
        const ruleDataRaw = fs.readFileSync('lib/existing-eks-nginx-observability-construct/rules.yml', 'utf8');

        const alertingRules = new amp.CfnRuleGroupsNamespace(clusterInfo.cluster.stack, 'AlertingRules', {
            name: 'accelerator-nginx-alerting',
            workspace: this.nginxPrometheusAddonProps.ampWorkspaceArn,
            data: ruleDataRaw
        });

        const flux_kustomization = new eks.KubernetesManifest(clusterInfo.cluster.stack, "Kustomization", {
            cluster: cluster,
            manifest: [
                {
                    apiVersion: 'kustomize.toolkit.fluxcd.io/v1',
                    kind: 'Kustomization',
                    metadata: {
                        name: 'grafana-dashboards-nginx',
                        namespace: 'flux-system',
                    },
                    spec: {
                        interval: '1m0s',
                        path: './artifacts/grafana-operator-manifests/eks/nginx',
                        prune: true,
                        sourceRef: {
                            kind: 'GitRepository',
                            name: 'grafana-dashboards',
                        },
                        postBuild: {
                            substitute: {
                                GRAFANA_NGINX_DASH_URL: "https://raw.githubusercontent.com/aws-observability/aws-observability-accelerator/main/artifacts/grafana-dashboards/eks/nginx/nginx.json",
                            },
                        },
                    },
                },
            ],
        });

        return Promise.resolve(flux_kustomization);
    }
}
