import 'source-map-support/register';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { KubectlProvider, ManifestDeployment } from "@aws-quickstart/eks-blueprints/dist/addons/helm-addon/kubectl-provider";
import { loadYaml, readYamlDocument } from '@aws-quickstart/eks-blueprints/dist/utils';

/**
 * Configuration options for the fluentbit configmap
 */
export interface FluentBitConfigMapProps {
    
    /**
     * Region to send cloudwatch logs.
     */
    awsRegion: string;

    /**
     * Log Group Name in cloudwatch
     */
    logGroupName: string

    /**
     * Prefix for logs stream
     */
    log_stream_prefix: string;

    /**
     * Enable logs from fluentBit process
     */
    enableFlbProcessLogs?: boolean
}

/**
 * Default props for the add-on.
 */
const defaultProps: FluentBitConfigMapProps = {
    awsRegion: "us-east-1",
    logGroupName: "fargate-observability",
    log_stream_prefix: "from-fluent-bit-",
    enableFlbProcessLogs: false
};

/**
 * Creates 'aws-observability' namespace and configurable ConfigMap
 * to enable the Fargate built-in log router based on Fluent Bit 
 * https://docs.aws.amazon.com/eks/latest/userguide/fargate-logging.html
 */
export class FluentBitConfigMap implements blueprints.ClusterAddOn {
    id?: string | undefined;
    readonly props: FluentBitConfigMapProps;

    constructor(props?: FluentBitConfigMapProps) {
        this.props = { ...defaultProps, ...props };
    }

    deploy(clusterInfo: blueprints.ClusterInfo): void {
        const cluster = clusterInfo.cluster;
        
        const doc = readYamlDocument(__dirname + '/../common/resources/fluent-bit/fluent-bit-fargate-config.ytpl');
        const manifest = doc.split("---").map(e => loadYaml(e));
        
        const values: blueprints.Values = {
            awsRegion: this.props.awsRegion,
            logGroupName: this.props.logGroupName,
            log_stream_prefix: this.props.log_stream_prefix,
            enableFlbProcessLogs: this.props.enableFlbProcessLogs,
        };

        const manifestDeployment: ManifestDeployment = {
            name: 'aws-logging',
            namespace: 'aws-observability',
            manifest,
            values
        };

        const kubectlProvider = new KubectlProvider(clusterInfo);
        kubectlProvider.addManifest(manifestDeployment);

    }
}