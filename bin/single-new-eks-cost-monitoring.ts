import { configureApp, errorHandler } from '../lib/common/construct-utils';
import SingleNewEksCostMonitoringPattern from '../lib/single-new-eks-cost-monitoring-pattern';

const app = configureApp();

new SingleNewEksCostMonitoringPattern()
    .buildAsync(app, 'single-new-eks-cost-monitoring')
    .catch((e) => {
        errorHandler(app, "Secure Ingress Cost monitoring Pattern could not be deployed. \
            See Secure Ingress Cost monitoring pattern in the readme for instructions", e);
    });