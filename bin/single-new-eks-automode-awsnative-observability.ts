import SingleNewEksAutoModeAWSNativeObservabilityPattern from '../lib/single-new-eks-automode-awsnative-observability-pattern';
import { configureApp } from '../lib/common/construct-utils';

const app = configureApp();

new SingleNewEksAutoModeAWSNativeObservabilityPattern(app, 'single-new-eks-automode-awsnative');
