# Viewing Logs

By default, we deploy a FluentBit daemon set in the cluster to collect worker logs for all namespaces. Logs are collected and exported to Amazon CloudWatch Logs, which enables you to centralize the logs from all of your systems, applications, and AWS services that you use, in a single, highly scalable service.

Further configuration options are available in the module documentation. This guide shows how you can leverage either CloudWatch Logs or Amazon Managed Grafana for your cluster and application logs.

## Viewing Logs in CloudWatch Logs Insights

Navigate to CloudWatch, then go to "Logs Insights"

In the dropdown, select any of the logs that begin with "/aws/eks/single-new-eks-mixed-observability-accelerator" and run a query.

Example with "kubesystem" log group:

![logs-query](./patterns/images/mixed-query.png)

Then you can view the results of your query:

![logs-results](./patterns/images/mixed-log-results.png)

## Viewing Logs in Grafana

### Using CloudWatch Logs as data source in Grafana

Follow [the documentation](https://docs.aws.amazon.com/grafana/latest/userguide/using-amazon-cloudwatch-in-AMG.html)
to enable Amazon CloudWatch as a data source. Make sure to provide permissions.

All logs are delivered in the following CloudWatch Log groups naming pattern:
`/aws/eks/$PATTERN`.
Log streams follow `{container-name}.{pod-name}`. In Grafana, querying and analyzing logs is done with [CloudWatch Logs Insights](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/AnalyzingLogData.html)

### Example - ADOT collector logs

Select one or many log groups and run the following query. The example below,
queries AWS Distro for OpenTelemetry (ADOT) logs

```console
fields @timestamp, log
| order @timestamp desc
| limit 100
```

![logs-1](./patterns/images/logs-1.png)

### Example - Using time series visualizations

[CloudWatch Logs syntax](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)
provide powerful functions to extract data from your logs. The `stats()`
function allows you to calculate aggregate statistics with log field values.
This is useful to have visualization on non-metric data from your applications.

In the example below, we use the following query to graph the number of metrics
collected by the ADOT collector

```console
fields @timestamp, log
| parse log /"#metrics": (?<metrics_count>\d+)}/
| stats avg(metrics_count) by bin(5m)
| limit 100
```

!!! tip
    You can add logs in your dashboards with logs panel types or time series
    depending on your query results type.

![logs-2](./patterns/images/logs-2.png)

!!! warning
    Querying CloudWatch logs will incur costs per GB scanned. Use small time
    windows and limits in your queries. Checkout the CloudWatch
    [pricing page](https://aws.amazon.com/cloudwatch/pricing/) for more info.



