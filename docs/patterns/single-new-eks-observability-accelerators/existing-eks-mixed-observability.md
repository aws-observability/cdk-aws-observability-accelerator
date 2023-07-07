# Existing EKS Cluster AWS Mixed Observability Accelerator

## Objective

This pattern depends on the previous deployment of [_Single New EKS Cluster Observability Accelerator_](./single-new-eks-cluster.md).
After deploying this pattern you will have the same setup as in [_Single New EKS Cluster AWS Mixed Observability Accelerator_](./single-new-eks-mixed-observability.md).

## Deploying

1. Follow the instructions in [_Single New EKS Cluster Observability Accelerator_](./single-new-eks-cluster.md).

2. Edit `~/.cdk.json` by setting the kubectl role name, as provided by the output of the above deployment of the _Single New EKS Cluster Observability Accelerator_.

```json
...
"existing.kubectl.rolename":""
...
```

3. Run the following command from the root of this repository to deploy the pipeline stack:

```bash
make build
make pattern existing-eks-mixed-observability deploy
```

## Verify the resources

Please see [_Single New EKS Cluster AWS Mixed Observability Accelerator_](./single-new-eks-mixed-observability.md).

## Teardown

You can teardown the whole CDK stack with the following command:

```bash
make pattern existing-eks-mixed-observability destroy
```


