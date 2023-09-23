import SingleNewEksGpuObservabilityPattern from '../lib/single-new-eks-gpu-observability-pattern';
import { configureApp } from '../lib/common/construct-utils';

const app = configureApp();

new SingleNewEksGpuObservabilityPattern(app, 'single-new-eks-gpu');