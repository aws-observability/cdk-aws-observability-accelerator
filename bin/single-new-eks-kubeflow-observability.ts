import SingleNewEksKubeflowobservabilityPattern from '../lib/single-new-eks-kubeflow-observability-pattern';
import { configureApp } from '../lib/common/construct-utils';

const app = configureApp();

new SingleNewEksKubeflowobservabilityPattern(app, 'single-new-eks-kubeflow');