import ExistingEksAwsNativeObservabilityConstruct from '../lib/existing-eks-awsnative-observability-construct';
import { configureApp, errorHandler } from '../lib/common/construct-utils';

const app = configureApp();

new ExistingEksAwsNativeObservabilityConstruct().buildAsync(app, 'existing-eks-awsnative').catch((error) => {
    errorHandler(app, "Existing Cluster Pattern is missing information of existing cluster: " + error);
});