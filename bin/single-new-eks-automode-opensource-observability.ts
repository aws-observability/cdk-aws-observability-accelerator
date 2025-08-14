import { configureApp } from '../lib/common/construct-utils';
import SingleNewEksAutoModeOpenSourcePattern from '../lib/single-new-eks-opensource-observability-pattern/graviton-index';

const app = configureApp();

new SingleNewEksAutoModeOpenSourcePattern(app, 'single-new-eks-automode-opensource');
