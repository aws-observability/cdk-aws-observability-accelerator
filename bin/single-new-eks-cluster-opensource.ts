import SingleNewEksClusterOpenSourceConstruct from '../lib/single-new-eks-cluster-opensource-construct';
import { configureApp } from '../lib/common/construct-utils';

const app = configureApp();

new SingleNewEksClusterOpenSourceConstruct(app, 'single-new-eks-cluster-opensource');