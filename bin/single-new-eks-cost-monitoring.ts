import { configureApp } from '../lib/common/construct-utils';
import SingleNewEksCostMonitoringPattern from '../lib/single-new-eks-cost-monitoring-pattern';

const app = configureApp();

new SingleNewEksCostMonitoringPattern(app, 'single-new-eks-cost-monitoring');