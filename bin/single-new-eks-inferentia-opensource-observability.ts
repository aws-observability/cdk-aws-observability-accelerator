import SingleNewEksInferentiaOpenSourceObservabilityPattern from '../lib/single-new-eks-opensource-observability-pattern/neuron/inferentia-index';
import { configureApp } from '../lib/common/construct-utils';

const app = configureApp();

new SingleNewEksInferentiaOpenSourceObservabilityPattern(app, 'single-new-eks-inferentia-opensource');