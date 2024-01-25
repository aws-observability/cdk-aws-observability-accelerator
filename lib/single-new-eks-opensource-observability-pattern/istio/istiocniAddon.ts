import 'source-map-support/register';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { Construct } from 'constructs';
import { dependable } from '@aws-quickstart/eks-blueprints/dist/utils';

const defaultProps: blueprints.HelmAddOnProps = {
    name: 'istio-cni',
    release: 'cni',
    namespace: 'istio-system',
    chart: 'cni',
    version: '1.18.2',
    repository: 'https://istio-release.storage.googleapis.com/charts',
    values: {}, 
};

export class IstioCniHelmAddon extends blueprints.HelmAddOn {

    constructor() {
        super({...defaultProps});
    }
    @dependable(blueprints.addons.IstioBaseAddOn.name,blueprints.addons.IstioControlPlaneAddOn.name)
    deploy(clusterInfo: blueprints.ClusterInfo): void | Promise<Construct> {
        const chart = this.addHelmChart(clusterInfo, this.props.values);
        return Promise.resolve(chart);
    }
}