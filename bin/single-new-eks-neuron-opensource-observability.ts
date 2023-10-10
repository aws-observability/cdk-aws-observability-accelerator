import SingleNewEksNeuronOpenSourceObservabilityPattern from '../lib/single-new-eks-opensource-observability-pattern/neuron/neuron-index';
import { configureApp } from '../lib/common/construct-utils';

const app = configureApp();

new SingleNewEksNeuronOpenSourceObservabilityPattern(app, 'single-new-eks-neuron-opensource');