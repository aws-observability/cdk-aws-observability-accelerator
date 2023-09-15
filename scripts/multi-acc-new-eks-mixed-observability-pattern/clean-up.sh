#!/bin/bash

#set -e # exit when any command fails

SCRIPT_PATH=$(pwd)/$(dirname $0)

source ${SCRIPT_PATH}/format-display.sh # format display
source ${SCRIPT_PATH}/source-envs.sh # sets required environment variables

# if [[ $# -lt 1 ]]; then
#     log 'R' "Usage: clean-up.sh <ARG 1>"
#     exit 1
# fi

# clean up apps from all envs


pipeline=(pipeline-account COA_PIPELINE_ACCOUNT_ID COA_PIPELINE_REGION)
prod1=(prod1-account COA_PROD1_ACCOUNT_ID COA_PROD1_REGION)
prod2=(prod2-account COA_PROD2_ACCOUNT_ID COA_PROD2_REGION)
mon=(monitoring-account COA_MON_ACCOUNT_ID COA_MON_REGION)

declare -A profiles
profiles[pipeline]=${pipeline[@]}
profiles[prod1]=${prod1[@]}
profiles[prod2]=${prod2[@]}
profiles[mon]=${mon[@]}

for profile in "${!profiles[@]}"; do
    # echo $profile # pipeline
    env=(${profiles[$profile]})
    # ${env[0]} is AWS PROFILE; ${!env[1]} is AWS ACCOUNT ID; ${!env[2]} is AWS REGION

    log 'G-H' "WORKING ON ${env[0]}.."

    if [ "$profile" != "pipeline" ]; then
        log 'O' "Initiating deletion of cloudformation stack in ${profile} account.."
        
        stackName="coa-eks-${profile}-${!env[2]}-coa-eks-${profile}-${!env[2]}-blueprint"
        [ "$profile" == "mon" ] && stackName="coa-cntrl-${profile}-${!env[2]}-coa-cntrl-${profile}-${!env[2]}-blueprint"
        log 'C' "Stack name: "$stackName

        nGRole=$(aws cloudformation describe-stack-resources --profile ${env[0]} --region ${!env[2]} \
        --stack-name ${stackName} \
        --query "StackResources[?ResourceType=='AWS::IAM::Role' && contains(LogicalResourceId,'NodeGroupRole')].PhysicalResourceId" \
        --output text)

        ClusterName=$(aws cloudformation describe-stacks --profile ${env[0]} --region ${!env[2]} \
            --stack-name ${stackName} \
            --query "Stacks[0].Outputs[?contains(OutputKey,'blueprintClusterName')].OutputValue" \
            --output text)

        aws cloudformation delete-stack --profile ${env[0]} --region ${!env[2]} \
            --stack-name ${stackName}

        kubeContext="arn:aws:eks:${!env[2]}:${!env[1]}:cluster/${ClusterName}"  
        log 'O' "Removing kubecontext ${kubeContext}.."
        kubectl config delete-context ${kubeContext}
    fi

    log 'O' "Cleaning CDK bootstrap for ${env[0]}.."
    # cdk bootstrap --destroy --profile ${env[0]}
    # cdk boostrap --clean --profile ${env[0]}
done

# aws ssm delete-parameter --profile pipeline-account --region ${COA_PIPELINE_REGION} --name "/cdk-accelerator/cdk-context"

# aws secretsmanager delete-secret --profile pipeline-account --region ${COA_PIPELINE_REGION} --secret-id "github-token" --force-delete-without-recovery
# aws secretsmanager delete-secret --profile monitoring-account --region ${COA_MON_REGION} --secret-id "github-ssh-key" --force-delete-without-recovery

# aws ssm delete-parameter --profile pipeline-account --region ${COA_PIPELINE_REGION} --name "/cdk-accelerator/pipeline-git-info"

# aws ssm delete-parameter --profile monitoring-account --region ${COA_MON_REGION} --name "/cdk-accelerator/grafana-api-key" 

# aws ssm delete-parameter --profile pipeline-account --region ${COA_PIPELINE_REGION} --name "/cdk-accelerator/amg-info"

# COA_AMG_WORKSPACE_NAME=$(aws ssm get-parameter --profile pipeline-account --region ${COA_PIPELINE_REGION} \
#     --name "/cdk-accelerator/amg-info" --with-decryption \
#     --query "Parameter.Value" --output text | jq .amg.workspaceName | sed 's/"//g')

# COA_AMG_WORKSPACE_ID=$(aws grafana list-workspaces --profile monitoring-account --region ${COA_MON_REGION} \
#     --query "workspaces[?name=='${COA_AMG_WORKSPACE_NAME}'].id" \
#     --output text)

# aws grafana delete-workspace-api-key --profile monitoring-account --region ${COA_MON_REGION} \
#     --key-name "grafana-operator-key"
#     --workspace-id $COA_AMG_WORKSPACE_ID

