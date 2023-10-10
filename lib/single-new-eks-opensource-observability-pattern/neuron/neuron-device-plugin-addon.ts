import { KubernetesManifest } from "aws-cdk-lib/aws-eks";
import { ClusterAddOn, ClusterInfo } from '@aws-quickstart/eks-blueprints';
import { loadExternalYaml } from "@aws-quickstart/eks-blueprints/dist/utils";

export class NeuronDevicePluginAddOn implements ClusterAddOn {
    deploy(clusterInfo: ClusterInfo): void {
        const cluster = clusterInfo.cluster;

        const plugin = loadExternalYaml(
            "https://raw.githubusercontent.com/aws-neuron/aws-neuron-sdk/master/src/k8/k8s-neuron-device-plugin.yml"
        );

        new KubernetesManifest(cluster.stack, "neuron-plugin-manifest", {
            cluster,
            manifest: plugin,
            overwrite: true
        });
    }
}
