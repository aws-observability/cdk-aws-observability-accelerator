import { configureApp } from '../lib/common/construct-utils';
import SingleNewEksAutoModeOpenSourceObservabilityPattern from '../lib/single-new-eks-opensource-observability-pattern/automode';

const app = configureApp();

new SingleNewEksAutoModeOpenSourceObservabilityPattern(app, 'single-new-eks-automode-opensource');
