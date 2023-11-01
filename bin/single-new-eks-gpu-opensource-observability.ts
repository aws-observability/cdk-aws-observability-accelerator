import SingleNewEksGpuOpenSourceObservabilityPattern from '../lib/single-new-eks-opensource-observability-pattern/gpu-index';
import { configureApp } from '../lib/common/construct-utils';

const app = configureApp();

new SingleNewEksGpuOpenSourceObservabilityPattern(app, 'single-new-eks-gpu-opensource');