#!/bin/bash

SCRIPT_PATH=$(git rev-parse --show-toplevel)/helpers/multi-acc-new-eks-mixed-observability-pattern

source ${SCRIPT_PATH}/format-display.sh # format display
source ${SCRIPT_PATH}/source-envs.sh # sets required environment variables

log 'O' "creating/updating kubeconfig entries.."

AWS_PROFILE=prod1-account
eval "$(aws cloudformation describe-stacks --profile prod1-account --region ${COA_PROD1_REGION} \
    --stack-name "coa-eks-prod1-${COA_PROD1_REGION}-coa-eks-prod1-${COA_PROD1_REGION}-blueprint" \
    --query "Stacks[0].Outputs[?contains(OutputKey,'blueprintConfigCommand')].OutputValue" \
    --output text)"

AWS_PROFILE=prod2-account
eval "$(aws cloudformation describe-stacks --profile prod2-account --region ${COA_PROD2_REGION} \
    --stack-name "coa-eks-prod2-${COA_PROD2_REGION}-coa-eks-prod2-${COA_PROD2_REGION}-blueprint" \
    --query "Stacks[0].Outputs[?contains(OutputKey,'blueprintConfigCommand')].OutputValue" \
    --output text)"

AWS_PROFILE=monitoring-account
eval "$(aws cloudformation describe-stacks --profile monitoring-account --region ${COA_MON_REGION} \
    --stack-name "coa-cntrl-mon-${COA_MON_REGION}-coa-cntrl-mon-${COA_MON_REGION}-blueprint" \
    --query "Stacks[0].Outputs[?contains(OutputKey,'blueprintConfigCommand')].OutputValue" \
    --output text)"

log 'O' "exporting cluster specific environment variables.."

export COA_PROD1_CLUSTER_NAME=$(aws cloudformation describe-stacks --profile prod1-account --region ${COA_PROD1_REGION} \
    --stack-name "coa-eks-prod1-${COA_PROD1_REGION}-coa-eks-prod1-${COA_PROD1_REGION}-blueprint" \
    --query "Stacks[0].Outputs[?contains(OutputKey,'blueprintClusterName')].OutputValue" \
    --output text)
export COA_PROD1_KUBE_CONTEXT="arn:aws:eks:${COA_PROD1_REGION}:${COA_PROD1_ACCOUNT_ID}:cluster/${COA_PROD1_CLUSTER_NAME}"

export COA_PROD2_CLUSTER_NAME=$(aws cloudformation describe-stacks --profile prod2-account --region ${COA_PROD2_REGION} \
    --stack-name "coa-eks-prod2-${COA_PROD2_REGION}-coa-eks-prod2-${COA_PROD2_REGION}-blueprint" \
    --query "Stacks[0].Outputs[?contains(OutputKey,'blueprintClusterName')].OutputValue" \
    --output text)
export COA_PROD2_KUBE_CONTEXT="arn:aws:eks:${COA_PROD2_REGION}:${COA_PROD2_ACCOUNT_ID}:cluster/${COA_PROD2_CLUSTER_NAME}"

export COA_MON_CLUSTER_NAME=$(aws cloudformation describe-stacks --profile monitoring-account --region ${COA_MON_REGION} \
    --stack-name "coa-cntrl-mon-${COA_MON_REGION}-coa-cntrl-mon-${COA_MON_REGION}-blueprint" \
    --query "Stacks[0].Outputs[?contains(OutputKey,'blueprintClusterName')].OutputValue" \
    --output text)
export COA_MON_KUBE_CONTEXT="arn:aws:eks:${COA_MON_REGION}:${COA_MON_ACCOUNT_ID}:cluster/${COA_MON_CLUSTER_NAME}"

log 'O' "exporting Amazon Managed Prometheus specific environment variables.."

export COA_AMP_WORKSPACE_ALIAS="observability-amp-Workspace"

export COA_AMP_WORKSPACE_ID=$(aws amp list-workspaces --profile prod1-account --region ${COA_PROD1_REGION} \
    --alias ${COA_AMP_WORKSPACE_ALIAS} \
    --query 'workspaces[0].[workspaceId]' \
    --output text)

export COA_AMP_WORKSPACE_ARN=$(aws amp list-workspaces --profile prod1-account --region ${COA_PROD1_REGION} \
    --alias ${COA_AMP_WORKSPACE_ALIAS} \
    --query 'workspaces[0].[arn]' \
    --output text)

export COA_AMP_ENDPOINT_URL=$(aws amp describe-workspace --profile prod1-account --region ${COA_PROD1_REGION} \
    --workspace-id ${COA_AMP_WORKSPACE_ID} \
    --query workspace.prometheusEndpoint \
    --output text)

export COA_AMP_REMOTEWRITE_URL=${COA_AMP_ENDPOINT_URL}api/v1/remote_write

log 'G' "DONE!"