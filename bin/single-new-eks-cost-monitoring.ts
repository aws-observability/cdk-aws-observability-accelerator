import { configureApp, errorHandler } from '../lib/common/construct-utils';
import SingleNewEksCostMonitoringPattern from '../lib/single-new-eks-cost-monitoring-pattern';

const app = configureApp();

new SingleNewEksCostMonitoringPattern()
    .buildAsync(app, 'single-new-eks-cost-monitoring')
    .catch((e) => {
        errorHandler(app, "Secure Ingress Cost monitoring Pattern is not setup due to missing secrets for ArgoCD admin pwd. \
            See Secure Ingress Cost monitroing pattern in the readme for instructions", e);
    });