import * as blueprints from '@aws-quickstart/eks-blueprints';
import { readYamlDocument } from "@aws-quickstart/eks-blueprints/dist/utils";
import { Construct } from 'constructs';
import { CfnRuleGroupsNamespace } from "aws-cdk-lib/aws-aps";
import { assert } from 'console';

/**
 * Configuration options for add-on
 */
export interface AmpRulesConfiguratorAddOnProps {
    /** 
     * AMP workspace ARN.
     */
    ampWorkspaceArn: string;

    /** 
     * Paths of the files listing the AMP rules.
     */
    ruleFilePaths: string[];
}

/**
 * Implementation of Rules configuration for AMP
 */
export class AmpRulesConfiguratorAddOn implements blueprints.ClusterAddOn {

    readonly ampRulesConfiguratorAddOn: AmpRulesConfiguratorAddOnProps;

    constructor(props: AmpRulesConfiguratorAddOnProps) {
        this.ampRulesConfiguratorAddOn = props;
    }

    deploy(clusterInfo: blueprints.ClusterInfo): Promise<Construct> {
        const cluster = clusterInfo.cluster;
        const ruleFilePaths = this.ampRulesConfiguratorAddOn.ruleFilePaths;
        const ruleGroupsNamespaces: CfnRuleGroupsNamespace[] = [];

        assert(ruleFilePaths.length > 0);

        ruleFilePaths.map((ruleFilePath, index) => {
            const ruleGroupsNamespace = new CfnRuleGroupsNamespace(cluster, "AmpRulesConfigurator-" + index, {
                data: readYamlDocument(ruleFilePath),
                name: "AmpRulesConfigurator-" + index,
                workspace: this.ampRulesConfiguratorAddOn.ampWorkspaceArn
            });
            if (index > 0){
                ruleGroupsNamespace.node.addDependency(ruleGroupsNamespaces.at(-1)!);
            }
            ruleGroupsNamespaces.push(ruleGroupsNamespace);
        });

        return Promise.resolve(ruleGroupsNamespaces.at(-1)!);
    }
}
