import SingleNewEksFargateOpenSourceObservabilityConstruct from '../lib/single-new-eks-fargate-opensource-observability-pattern';
import { configureApp } from '../lib/common/construct-utils';

const app = configureApp();
new SingleNewEksFargateOpenSourceObservabilityConstruct(app, 'single-new-eks-fargate-opensource');