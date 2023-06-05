import SingleNewEksClusterMixedConstruct from '../lib/single-new-eks-cluster-mixed-construct';
import { configureApp } from '../lib/common/construct-utils';

const app = configureApp();

new SingleNewEksClusterMixedConstruct(app, 'single-new-eks-cluster-mixed');