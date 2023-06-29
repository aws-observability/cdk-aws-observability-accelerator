import { configureApp } from '../lib/common/construct-utils';
import SingleNewEksConstruct from '../lib/single-new-eks-cluster-construct';

const app = configureApp();

new SingleNewEksConstruct(app, 'single-new-eks');