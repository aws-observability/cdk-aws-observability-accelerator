import ExistingEksAwsNativeFargateObservabilityConstruct from '../lib/existing-eks-awsnative-fargate-observability-construct';
import { configureApp, errorHandler } from '../lib/common/construct-utils';

const app = configureApp();

new ExistingEksAwsNativeFargateObservabilityConstruct().buildAsync(app, 'existing-eks-awsnative-fargate').catch((error) => {
    errorHandler(app, "Existing Cluster Pattern is missing information of existing cluster: " + error);
});