import SingleNewEksCostMonitoringPattern from '../lib/single-new-eks-cost-monitoring-pattern';
import { configureApp } from '../lib/common/construct-utils';

const app = configureApp();

new SingleNewEksCostMonitoringPattern(app, "single-new-eks-awsnative-cost");