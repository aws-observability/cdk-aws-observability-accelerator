import { configureApp } from '../lib/common/construct-utils';
import SingleNewEksPattern from '../lib/single-new-eks-cluster-pattern';

const app = configureApp();

new SingleNewEksPattern(app, 'single-new-eks');