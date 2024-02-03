import 'source-map-support/register';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import * as eks from "aws-cdk-lib/aws-eks";
import { Construct } from 'constructs';
import { loadYaml, readYamlDocument } from '@aws-quickstart/eks-blueprints/dist/utils';

export class FluentBitConfigMap implements blueprints.ClusterAddOn {
    id?: string | undefined;
    deploy(clusterInfo: blueprints.ClusterInfo): void | Promise<Construct> {
        const cluster = clusterInfo.cluster;

        const doc = readYamlDocument(__dirname + '/fluentbitconfig.yml');
        const manifest = doc.split("---").map(e => loadYaml(e));
        
        const configMap = new eks.KubernetesManifest(cluster.stack, "aws-observability", {
            cluster,
            manifest,
            overwrite: true
        });
       
        return Promise.resolve(configMap);
    }
}