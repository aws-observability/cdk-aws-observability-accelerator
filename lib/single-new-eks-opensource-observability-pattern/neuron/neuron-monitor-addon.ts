import { KubernetesManifest } from "aws-cdk-lib/aws-eks";
import { ClusterAddOn, ClusterInfo } from '@aws-quickstart/eks-blueprints';
import { readYamlDocument, loadYaml } from "@aws-quickstart/eks-blueprints/dist/utils";

export class NeuronMonitorAddOn implements ClusterAddOn {
    deploy(clusterInfo: ClusterInfo): void {
        const cluster = clusterInfo.cluster;

        const neuronMonitorDoc = readYamlDocument(__dirname + '/neuron-monitor.yaml');
        const neuronMonitorManifest = neuronMonitorDoc.split("---").map(e => loadYaml(e));

        new KubernetesManifest(cluster.stack, "neuron-monitor-manifest", {
            cluster,
            manifest: neuronMonitorManifest,
            overwrite: true
        });
    }
}
