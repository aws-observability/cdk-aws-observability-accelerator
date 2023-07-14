import * as blueprints from '@aws-quickstart/eks-blueprints';
import { loadYaml, readYamlDocument } from "@aws-quickstart/eks-blueprints/dist/utils";
import { Construct } from 'constructs';
import { KubernetesManifest } from "aws-cdk-lib/aws-eks";

/**
 * Configuration options for add-on
 */
export interface AmpRulesConfiguratorAddOnProps {
    /** 
     * AMP workspace ID.
     */
    ampWorkspaceId: string;

    /** 
     * Namespace where the RuleGroupsNamespace objects will be deployed in
     * @default "ack-system"
     */
    namespace?: string;
}

/**
 * Default props
 */
const defaultProps = {
    namespace: "ack-system"
};

/**
 * Implementation of Rules configuration for AMP
 */
export class AmpRulesConfiguratorAddOn implements blueprints.ClusterAddOn {

    readonly ampRulesConfiguratorAddOn: AmpRulesConfiguratorAddOnProps;

    constructor(props: AmpRulesConfiguratorAddOnProps) {
        this.ampRulesConfiguratorAddOn = { ...defaultProps, ...props };
    }

    deploy(clusterInfo: blueprints.ClusterInfo): Promise<Construct> {
        const cluster = clusterInfo.cluster;

        let kubernetesManifest!: KubernetesManifest;
        const fileNames = ['/rules-1.ytpl', '/rules-2.ytpl'];

        fileNames.map((fileName, index) => {
            let doc = readYamlDocument(__dirname +fileName);
            doc = doc.replace(new RegExp(`{{workspaceId}}`, 'g'), this.ampRulesConfiguratorAddOn.ampWorkspaceId);
            doc = doc.replace(new RegExp(`{{namespace}}`, 'g'), this.ampRulesConfiguratorAddOn.namespace!);
            const manifest = doc.split("---").map(e => loadYaml(e));

            kubernetesManifest = new KubernetesManifest(cluster.stack, "AmpRulesConfiguratorManifest-" + index, {
                cluster: cluster,
                manifest
            });
        });

        return Promise.resolve(kubernetesManifest);
    }
}
