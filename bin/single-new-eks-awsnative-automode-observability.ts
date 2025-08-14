import SingleNewEksAutoModeAWSNativeObservabilityPattern from '../lib/single-new-eks-awsnative-automode-observability-pattern';
import { configureApp } from '../lib/common/construct-utils';

const app = configureApp();

new SingleNewEksAutoModeAWSNativeObservabilityPattern(app, 'single-new-eks-awsnative-automode');
