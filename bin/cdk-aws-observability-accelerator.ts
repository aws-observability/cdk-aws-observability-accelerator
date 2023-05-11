#!/usr/bin/env node

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { GrafanaOperatorSecretAddon } from '../lib/grafanaoperatorsecretaddon';

const app = new cdk.App();

const account = process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;
const clusterName = process.env.COA_CLUSTER_NAME! || 'observability-accelarator-cluster';
const ampWorkspaceName = process.env.COA_AMP_WORKSPACE_NAME! || 'observability-amp-Workspace';

const addOns: Array<blueprints.ClusterAddOn> = [
    new blueprints.addons.AwsLoadBalancerControllerAddOn(),
    new blueprints.addons.VpcCniAddOn(),
    new blueprints.addons.CoreDnsAddOn(),
    new blueprints.addons.KubeProxyAddOn(),
    new blueprints.addons.CertManagerAddOn(),
    new blueprints.addons.ExternalsSecretsAddOn(),
    new blueprints.addons.PrometheusNodeExporterAddOn(),
    new blueprints.addons.KubeStateMetricsAddOn(),
    new blueprints.addons.AdotCollectorAddOn(),
    new blueprints.addons.AmpAddOn({
        workspaceName: ampWorkspaceName,
    }),
    new blueprints.addons.GrafanaOperatorAddon(),
    new GrafanaOperatorSecretAddon(),
];

const stack = blueprints.EksBlueprint.builder()
    .account(account)
    .region(region)
    .addOns(...addOns)
    .build(app, clusterName);
