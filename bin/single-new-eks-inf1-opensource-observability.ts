import SingleNewEksInf1OpenSourceObservabilityPattern from '../lib/single-new-eks-opensource-observability-pattern/inferentia-inf1-index';
import { configureApp } from '../lib/common/construct-utils';

const app = configureApp();

new SingleNewEksInf1OpenSourceObservabilityPattern(app, 'single-new-eks-inf1-opensource');