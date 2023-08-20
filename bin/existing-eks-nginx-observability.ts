import ExistingEksNginxConstruct from '../lib/existing-eks-nginx-observability-construct';
import { configureApp, errorHandler } from '../lib/common/construct-utils';

const app = configureApp();

new ExistingEksNginxConstruct().buildAsync(app, 'existing-eks-nginx').catch((error) => {
    errorHandler(app, "Existing Cluster Pattern is missing information of existing cluster: " + error);
});