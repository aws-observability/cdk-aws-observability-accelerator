import SingleNewEksMixedobservabilityPattern from '../lib/single-new-eks-mixed-observability-pattern';
import { configureApp } from '../lib/common/construct-utils';

const app = configureApp();

new SingleNewEksMixedobservabilityPattern(app, 'single-new-eks-mixed');