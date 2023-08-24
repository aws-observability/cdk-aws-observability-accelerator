import ExistingEksOpenSourceobservabilityPattern from '../lib/existing-eks-opensource-observability-pattern';
import { configureApp, errorHandler } from '../lib/common/construct-utils';

const app = configureApp();

new ExistingEksOpenSourceobservabilityPattern().buildAsync(app, 'existing-eks-opensource').catch((error) => {
    errorHandler(app, "Existing Cluster Pattern is missing information of existing cluster: " + error);
});