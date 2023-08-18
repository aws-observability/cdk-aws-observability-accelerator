import SingleNewEksAWSNativeobservabilityPattern from '../lib/single-new-eks-awsnative-observability-pattern';
import { configureApp } from '../lib/common/construct-utils';

const app = configureApp();

new SingleNewEksAWSNativeobservabilityPattern(app, 'single-new-eks-awsnative');