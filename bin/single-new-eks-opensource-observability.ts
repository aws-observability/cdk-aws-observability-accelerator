import SingleNewEksOpenSourceobservabilityPattern from '../lib/single-new-eks-opensource-observability-pattern';
import { configureApp } from '../lib/common/construct-utils';

const app = configureApp();

new SingleNewEksOpenSourceobservabilityPattern(app, 'single-new-eks-opensource');
