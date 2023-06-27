import { configureApp } from '../lib/common/construct-utils';
import SingleNewEksGravitonOpenSourceObservabilityConstruct from '../lib/single-new-eks-opensource-observability-construct/graviton-index';

const app = configureApp();

new SingleNewEksGravitonOpenSourceObservabilityConstruct(app, 'single-new-eks-graviton-opensource');
