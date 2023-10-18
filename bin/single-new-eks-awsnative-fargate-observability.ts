import SingleNewEksAWSNativeFargateobservabilityConstruct from '../lib/single-new-eks-awsnative-fargate-observability-construct';
import { configureApp } from '../lib/common/construct-utils';

const app = configureApp();

new SingleNewEksAWSNativeFargateobservabilityConstruct(app, 'single-new-eks-awsnative-fargate');