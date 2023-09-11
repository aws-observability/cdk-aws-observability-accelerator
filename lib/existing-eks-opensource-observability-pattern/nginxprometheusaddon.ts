import 'source-map-support/register';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import * as eks from "aws-cdk-lib/aws-eks";
import { Construct } from 'constructs';
import { dependable } from '@aws-quickstart/eks-blueprints/dist/utils';

export class NginxPrometheusAddon implements blueprints.ClusterAddOn {
    id?: string | undefined;

    @dependable(blueprints.addons.ExternalsSecretsAddOn.name)
    deploy(clusterInfo: blueprints.ClusterInfo): void | Promise<Construct> {
        const cluster = clusterInfo.cluster;

        const flux_kustomization = new eks.KubernetesManifest(clusterInfo.cluster.stack, "Kustomization", {
            cluster: cluster,
            manifest: [
                {
                    apiVersion: 'kustomize.toolkit.fluxcd.io/v1',
                    kind: 'Kustomization',
                    metadata: {
                        name: 'grafana-dashboards-nginx',
                        namespace: 'grafana-operator',
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
