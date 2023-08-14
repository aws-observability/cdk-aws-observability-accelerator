import SingleNewEksOpenSourceobservabilityConstruct from '../lib/single-new-eks-opensource-observability';
import { configureApp } from '../lib/common/construct-utils';

const app = configureApp();

new SingleNewEksOpenSourceobservabilityConstruct(app, 'single-new-eks-opensource');
