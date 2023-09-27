#!/bin/bash

SCRIPT_PATH=$(git rev-parse --show-toplevel)/helpers/multi-acc-new-eks-mixed-observability-pattern

source ${SCRIPT_PATH}/format-display.sh # format display

log 'O' "exporting account specific env variables.."
export COA_PIPELINE_ACCOUNT_ID=$(aws configure get sso_account_id --profile pipeline-account)
export COA_PIPELINE_REGION=$(aws configure get region --profile pipeline-account)

export COA_PROD1_ACCOUNT_ID=$(aws configure get sso_account_id --profile prod1-account)
export COA_PROD1_REGION=$(aws configure get region --profile prod1-account)

export COA_PROD2_ACCOUNT_ID=$(aws configure get sso_account_id --profile prod2-account)
export COA_PROD2_REGION=$(aws configure get region --profile prod2-account)

export COA_MON_ACCOUNT_ID=$(aws configure get sso_account_id --profile monitoring-account)
export COA_MON_REGION=$(aws configure get region --profile monitoring-account)

existingParam=$(aws ssm describe-parameters --profile pipeline-account --region ${COA_PIPELINE_REGION} --query "length(Parameters[?Name=='/cdk-accelerator/amg-info'])")
if [ $existingParam -eq 0 ]; then
    read -p "NAME of AMG Workspace in monitoringEnv of monitoringEnv account: " amgname_input
    export COA_AMG_WORKSPACE_NAME=$amgname_input
else
    export COA_AMG_WORKSPACE_NAME=$(aws ssm get-parameter --profile pipeline-account --region ${COA_PIPELINE_REGION} \
        --name "/cdk-accelerator/amg-info" \
        --with-decryption \
        --query Parameter.Value \
        --output text | jq -r ".[] | .workspaceName")
fi

log 'O' "exporting monitoring-account's Amazon Grafana specific env variables.."
export COA_AMG_WORKSPACE_URL="https://$(aws grafana list-workspaces --profile monitoring-account --region ${COA_MON_REGION} \
    --query "workspaces[?name=='${COA_AMG_WORKSPACE_NAME}'].endpoint" \
    --output text)"

export COA_AMG_WORKSPACE_ID=$(aws grafana list-workspaces --profile monitoring-account --region ${COA_MON_REGION} \
    --query "workspaces[?name=='${COA_AMG_WORKSPACE_NAME}'].id" \
    --output text)

export COA_AMG_WORKSPACE_ROLE_ARN=$(aws grafana describe-workspace --profile monitoring-account --region ${COA_MON_REGION} \
    --workspace-id $COA_AMG_WORKSPACE_ID \
    --query "workspace.workspaceRoleArn" \
    --output text)

log 'G' "Exported env variables"
env | grep ^COA_ | sort -u

log 'G' "DONE!"
