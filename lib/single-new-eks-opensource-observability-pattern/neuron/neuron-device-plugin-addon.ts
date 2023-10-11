import { KubernetesManifest, ServiceAccount } from "aws-cdk-lib/aws-eks";
import { ClusterAddOn, ClusterInfo } from '@aws-quickstart/eks-blueprints';
import { loadExternalYaml, readYamlDocument, loadYaml } from "@aws-quickstart/eks-blueprints/dist/utils";

export class NeuronDevicePluginAddOn implements ClusterAddOn {
    deploy(clusterInfo: ClusterInfo): void {
        const sa = this.createServiceAccount(clusterInfo);

        const cluster = clusterInfo.cluster;

        const plugin = loadExternalYaml(
            "https://raw.githubusercontent.com/aws-neuron/aws-neuron-sdk/master/src/k8/k8s-neuron-device-plugin.yml"
        );

        const neuronDevicePluginManifest = new KubernetesManifest(cluster.stack, "neuron-plugin-manifest", {
            cluster,
            manifest: plugin,
            overwrite: true
        });

        neuronDevicePluginManifest.node.addDependency(sa);

        let doc = readYamlDocument(`${__dirname}/neuron-device-plugin-role.yaml`);
        const roleManifest = doc.split("---").map(e => loadYaml(e));
    
        const neuronDevicePluginRoleManifest = new KubernetesManifest(cluster.stack, "neuron-device-plugin-role-manifest", {
            cluster,
            manifest: roleManifest,
            overwrite: true
        });

        neuronDevicePluginRoleManifest.node.addDependency(sa);
        neuronDevicePluginManifest.node.addDependency(neuronDevicePluginRoleManifest);
    }


    protected createServiceAccount(clusterInfo: ClusterInfo): ServiceAccount {
        const sa = clusterInfo.cluster.addServiceAccount('neuron-device-plugin', {
            name: "neuron-device-plugin",
            namespace: "kube-system"
        });
        return sa;
    }
}
