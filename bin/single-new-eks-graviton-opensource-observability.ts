import { configureApp } from '../lib/common/construct-utils';
import SingleNewEksGravitonOpenSourceObservabilityPattern from '../lib/single-new-eks-opensource-observability-pattern/graviton-index';

const app = configureApp();

new SingleNewEksGravitonOpenSourceObservabilityPattern(app, 'single-new-eks-graviton-opensource');
