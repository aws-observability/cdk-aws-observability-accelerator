import { KubernetesManifest } from "aws-cdk-lib/aws-eks";
import { ClusterAddOn, ClusterInfo } from '@aws-quickstart/eks-blueprints';
import { loadYaml, readYamlDocument, loadExternalYaml } from "@aws-quickstart/eks-blueprints/dist/utils";

export class NeuronDevicePluginAddOn implements ClusterAddOn {
    deploy(clusterInfo: ClusterInfo): void {
        const cluster = clusterInfo.cluster;

        // Read in YAML docs
        const rbac = loadExternalYaml(
            "https://awsdocs-neuron.readthedocs-hosted.com/en/latest/_downloads/46fb1da6e5e79c3310ebc0cbd6ad2353/k8s-neuron-device-plugin-rbac.yml"
        );

        const plugin = loadExternalYaml(
            "https://awsdocs-neuron.readthedocs-hosted.com/en/latest/_downloads/f57f27621e52b305dba7d624c477977a/k8s-neuron-device-plugin.yml"
        );

        const torchNeuron = readYamlDocument(__dirname + '/torch-neuron.yml');
        
        // Apply Manifests
        // const rbacLoadYaml = rbac.split("---").map((e: any) => loadYaml(e));
        const rbacManifest = new KubernetesManifest(cluster.stack, "neuron-rbac-manifest", {
            cluster,
            manifest: rbac,
            overwrite: true
        });

        // const pluginLoadYaml = plugin.split("---").map((e: any) => loadYaml(e));
        const pluginManifest = new KubernetesManifest(cluster.stack, "neuron-plugin-manifest", {
            cluster,
            manifest: plugin,
            overwrite: true
        });

        const torchNeuronLoadYaml = torchNeuron.split("---").map(e => loadYaml(e));
        const torchNeuronManifest = new KubernetesManifest(cluster.stack, "torch-neuron-manifest", {
            cluster,
            manifest: torchNeuronLoadYaml,
            overwrite: true
        });

        // Dependencies
        pluginManifest.node.addDependency(rbacManifest);
        torchNeuronManifest.node.addDependency(pluginManifest);
    }
}
