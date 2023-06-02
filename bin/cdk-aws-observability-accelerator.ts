#!/usr/bin/env node

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { GrafanaOperatorSecretAddon } from '../lib/grafanaoperatorsecretaddon';
import * as amp from 'aws-cdk-lib/aws-aps';
const assert = require('assert').strict

const app = new cdk.App();

const account = process.env.COA_ACCOUNT_ID! || process.env.CDK_DEFAULT_ACCOUNT!;
const region = process.env.COA_AWS_REGION! || process.env.CDK_DEFAULT_REGION!;
const clusterName = process.env.COA_CLUSTER_NAME! || 'observability-accelarator-cluster';
const ampWorkspaceName = process.env.COA_AMP_WORKSPACE_NAME! || 'observability-amp-Workspace';
const ampPrometheusEndpoint = (blueprints.getNamedResource(ampWorkspaceName) as unknown as amp.CfnWorkspace).attrPrometheusEndpoint;
const nodeExporterDashUrl = "https://raw.githubusercontent.com/aws-samples/one-observability-demo/main/grafana-dashboards/nodeexporter-nodes.json"
const amgEndpointUrl = process.env.COA_AMG_ENDPOINT_URL;
assert.ok(amgEndpointUrl, 'The "amgEndpointUrl" environment variable needs to be populated with AMG URL Endpoint');

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
        ampPrometheusEndpoint: ampPrometheusEndpoint,
    }),
    new blueprints.addons.GrafanaOperatorAddon(),
    new blueprints.addons.FluxCDAddOn({
        bootstrapRepo: {
            repoUrl: 'https://github.com/aws-observability/aws-observability-accelerator',
            name: "grafana-dashboards",
            targetRevision: "main",
            path: "./artifacts/grafana-operator-manifests"
        },
        bootstrapValues: {
            "AMG_AWS_REGION": region,
            "AMP_ENDPOINT_URL": ampPrometheusEndpoint,
            "AMG_ENDPOINT_URL": amgEndpointUrl,
            "GRAFANA_NODEEXP_DASH_URL" : nodeExporterDashUrl
        },
    }),
    new GrafanaOperatorSecretAddon(),
];

const stack = blueprints.EksBlueprint.builder()
    .account(account)
    .region(region)
    .resourceProvider(ampWorkspaceName, new blueprints.CreateAmpProvider(ampWorkspaceName, ampWorkspaceName))
    .addOns(...addOns)
    .build(app, clusterName);
