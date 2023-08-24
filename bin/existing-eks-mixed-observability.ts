import ExistingEksMixedPattern from '../lib/existing-eks-mixed-observability-pattern';
import { configureApp, errorHandler } from '../lib/common/construct-utils';

const app = configureApp();

new ExistingEksMixedPattern().buildAsync(app, 'existing-eks-mixed').catch((error) => {
    errorHandler(app, "Existing Cluster Pattern is missing information of existing cluster: " + error);
});