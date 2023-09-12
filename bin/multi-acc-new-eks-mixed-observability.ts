
import { configureApp, errorHandler } from '../lib/common/construct-utils';
import { PipelineMultiEnvMonitoring } from '../lib/multi-acc-new-eks-mixed-observability-pattern';

const app = configureApp();

/*
CDK Observability Accelerator pattern for Multiple EKS clusters in multiple AWS accounts
*/

new PipelineMultiEnvMonitoring()
    .buildAsync(app)
    .catch((e) => {
        errorHandler(app, "Multi Account Multi EKS CDK Observability pattern setup errored. Ensure SSM SecureString Parameter /cdk-accelerator/cdk-context exists in COA_PIPELINE_REGION of pipeline account. See documentation for details.", e);
    });