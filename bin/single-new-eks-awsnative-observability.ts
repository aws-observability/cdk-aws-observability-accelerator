import SingleNewEksAWSNativeobservabilityConstruct from '../lib/single-new-eks-awsnative-observability';
import { configureApp } from '../lib/common/construct-utils';

const app = configureApp();

new SingleNewEksAWSNativeobservabilityConstruct(app, 'single-new-eks-awsnative');