import { configureApp } from '../lib/common/construct-utils';
import SingleNewEksGravitonOpenSourceObservabilityConstruct from '../lib/single-new-eks-opensource-observability/graviton-index';

const app = configureApp();

new SingleNewEksGravitonOpenSourceObservabilityConstruct(app, 'single-new-eks-graviton-opensource');
