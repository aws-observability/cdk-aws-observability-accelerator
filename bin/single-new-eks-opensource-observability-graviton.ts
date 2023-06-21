import { configureApp } from '../lib/common/construct-utils';
import SingleNewEksOpenSourceGravitonObservabilityConstruct from '../lib/single-new-eks-opensource-observability-construct/graviton-index';

const app = configureApp();

new SingleNewEksOpenSourceGravitonObservabilityConstruct(app, 'single-new-eks-opensource-graviton')
