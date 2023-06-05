import SingleNewEksClusterAWSNativeConstruct from '../lib/single-new-eks-cluster-awsnative-construct';
import { configureApp } from '../lib/common/construct-utils';

const app = configureApp();

new SingleNewEksClusterAWSNativeConstruct(app, 'single-new-eks-cluster-awsnative');