import { configureApp } from '../lib/common/construct-utils';
import SingleNewEksAutoModeOpenSourcePattern from '../lib/single-new-eks-opensource-observability-pattern/automode';

const app = configureApp();

new SingleNewEksAutoModeOpenSourcePattern(app, 'single-new-eks-automode-opensource');
