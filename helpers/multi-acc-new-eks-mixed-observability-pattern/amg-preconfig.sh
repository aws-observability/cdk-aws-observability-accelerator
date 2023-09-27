#!/bin/bash

set -e # exit when any command fails

SCRIPT_PATH=$(git rev-parse --show-toplevel)/helpers/multi-acc-new-eks-mixed-observability-pattern

source ${SCRIPT_PATH}/format-display.sh # format display
# source ${SCRIPT_PATH}/source-envs.sh # sets required environment variables

existingParam=$(aws ssm describe-parameters --profile pipeline-account --region ${COA_PIPELINE_REGION} --query "length(Parameters[?Name=='/cdk-accelerator/amg-info'])")
if [ $existingParam -eq 0 ]; then
    log 'O' "creating SSM SecureString parameter /cdk-accelerator/amg-info in ${COA_PIPELINE_REGION} region of pipeline-account (${COA_PIPELINE_ACCOUNT_ID}).."
    aws ssm put-parameter --profile pipeline-account --region ${COA_PIPELINE_REGION} \
        --type "SecureString" \
        --overwrite \
        --name "/cdk-accelerator/amg-info" \
        --description "Info on Amazon Grafana in Monitoring Account" \
        --value '{
        "amg": {
            "workspaceName": "'${COA_AMG_WORKSPACE_NAME}'",
            "workspaceURL": "'${COA_AMG_WORKSPACE_URL}'",
            "workspaceID": "'${COA_AMG_WORKSPACE_ID}'",
            "workspaceIAMRoleARN": "'${COA_AMG_WORKSPACE_ROLE_ARN}'"
        }
    }'
else
    log 'B' "SSM SecureString parameter /cdk-accelerator/amg-info exists in ${COA_PIPELINE_REGION} region of pipeline-account (${COA_PIPELINE_ACCOUNT_ID})."
fi


existingParam=$(aws ssm describe-parameters --profile monitoring-account --region ${COA_MON_REGION} --query "length(Parameters[?Name=='/cdk-accelerator/grafana-api-key'])")
if [ $existingParam -eq 0 ]; then
    log 'O' "creating Amazon Grafana workspace API key.."
    export COA_AMG_API_KEY=$(aws grafana create-workspace-api-key --profile monitoring-account --region ${COA_MON_REGION} \
        --key-name "grafana-operator-key" \
        --key-role "ADMIN" \
        --seconds-to-live 432000 \
        --workspace-id $COA_AMG_WORKSPACE_ID \
        --query key \
        --output text)

    log 'O' "creating SSM SecureString parameter /cdk-accelerator/grafana-api-key in ${COA_MON_REGION} region of monitoring-account (${COA_MON_ACCOUNT_ID}).."
    aws ssm put-parameter --profile monitoring-account --region ${COA_MON_REGION} \
    --type "SecureString" \
    --overwrite \
    --name "/cdk-accelerator/grafana-api-key" \
    --description "Amazon Grafana workspace API key for use by External Secrets Operator" \
    --value ${COA_AMG_API_KEY}
else
    log 'B' "SSM SecureString parameter /cdk-accelerator/grafana-api-key exists in ${COA_MON_REGION} region of monitoring-account (${COA_MON_ACCOUNT_ID})."
fi

log 'G' "DONE!"
