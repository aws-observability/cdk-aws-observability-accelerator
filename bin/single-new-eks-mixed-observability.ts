import SingleNewEksMixedobservabilityConstruct from '../lib/single-new-eks-mixed-observability';
import { configureApp } from '../lib/common/construct-utils';

const app = configureApp();

new SingleNewEksMixedobservabilityConstruct(app, 'single-new-eks-mixed');