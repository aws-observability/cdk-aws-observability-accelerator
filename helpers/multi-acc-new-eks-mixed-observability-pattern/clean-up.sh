#!/bin/bash

# set -e # exit when any command fails

NC='\033[0m'       # Text Reset
R='\033[0;31m'          # Red
G='\033[0;32m'        # Green
Y='\033[0;33m'       # Yellow
echo -e "${R}"

read -p "This script will clean up all resources deployed as part of this pattern. Are you sure you want to proceed [y/N]? " -n 2
echo -e "\n"
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo -e "${Y}proceeding with clean up steps.${NC}"
    echo -e "\n"
else
    exit 1
fi

SCRIPT_PATH=$(git rev-parse --show-toplevel)/helpers/multi-acc-new-eks-mixed-observability-pattern

source ${SCRIPT_PATH}/format-display.sh # format display
source ${SCRIPT_PATH}/post-deployment-source-envs.sh # sets required environment variables

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
    log 'B' "Account ID: ${!env[1]}"
    log 'B' "Region: ${!env[2]}"

    if [ "$profile" != "pipeline" ]; then
        stackName="coa-eks-${profile}-${!env[2]}-coa-eks-${profile}-${!env[2]}-blueprint"
        [ "$profile" == "mon" ] && stackName="coa-cntrl-${profile}-${!env[2]}-coa-cntrl-${profile}-${!env[2]}-blueprint"
        log 'C' "Stack name: "$stackName

        # nGRole=$(aws cloudformation describe-stack-resources --profile ${env[0]} --region ${!env[2]} \
        # --stack-name ${stackName} \
        # --query "StackResources[?ResourceType=='AWS::IAM::Role' && contains(LogicalResourceId,'NodeGroupRole')].PhysicalResourceId" \
        # --output text)

        ClusterName=$(aws cloudformation describe-stacks --profile ${env[0]} --region ${!env[2]} \
            --stack-name ${stackName} \
            --query "Stacks[0].Outputs[?contains(OutputKey,'blueprintClusterName')].OutputValue" \
            --output text)

        kubeContext="arn:aws:eks:${!env[2]}:${!env[1]}:cluster/${ClusterName}"

        log 'O' "Initiating clean up of argocd apps in ${profile} account.."
        read -p "Press any key to continue.."

        kubectl --context ${kubeContext} delete applications.argoproj.io bootstrap-apps -n argocd

        appNames=($(kubectl --context ${kubeContext} get applications.argoproj.io -n argocd -o custom-columns=":metadata.name" --no-headers))

        for appName in "${appNames[@]}"; do
            kubectl --context ${kubeContext} delete applications.argoproj.io "$appName" -n argocd
        done

        # log 'O' "deleting nodegroup IAM Role for ${env[0]}.."
        # read -p "Press any key to continue.."
        # aws iam delete-role --profile ${env[0]} \
        #     --role-name ${nGRole}

        log 'O' "Removing kubeconfig entries of ${kubeContext}.."
        read -p "Press any key to continue.."

        kubectl config unset contexts.${kubeContext}
        kubectl config unset clusters.${kubeContext}
        kubectl config unset users.${kubeContext}
        # kubectl config delete-context ${kubeContext}
        kubectl config unset current-context

        sed -i -e 's/clusters: null/clusters: []/g' -e 's/contexts: null/contexts: []/g' -e 's/users: null/users: []/g' ~/.kube/config

        log 'O' "Initiating deletion of cloudformation stack in ${profile} account.."
        read -p "Press any key to continue.."

        aws cloudformation delete-stack --profile ${env[0]} --region ${!env[2]} \
            --stack-name ${stackName}
    # else
    #     aws cloudformation delete-stack --profile ${env[0]} --region ${!env[2]} \
    #         --stack-name "multi-account-COA-pipeline-support-${!env[2]}"
    fi

    # log 'O' "cleaning CDK bootstrap for ${env[0]}.."
    # read -p "Press any key to continue.."

    # BUCKET_TO_DELETE=$(aws s3 --profile ${env[0]} ls | grep cdk-.*"${!env[2]}" | cut -d' ' -f3)
    # if [[ ! -z $BUCKET_TO_DELETE ]]
    # then
    #     OBJECT_COUNT=$(aws s3api --profile ${env[0]} list-object-versions --region ${!env[2]} \
    #         --bucket ${BUCKET_TO_DELETE} --query='{Objects: Versions[].{Key:Key,VersionId:VersionId}}' \
    #         --output text | grep -v ^None | wc -l)

    #     if [[ $OBJECT_COUNT > 0 ]]
    #     then
    #         aws s3api --profile ${env[0]} delete-objects --region ${!env[2]} \
    #             --bucket ${BUCKET_TO_DELETE} \
    #             --delete "$(aws s3api --profile ${env[0]} list-object-versions --region ${!env[2]} \
    #             --bucket ${BUCKET_TO_DELETE} --query='{Objects: Versions[].{Key:Key,VersionId:VersionId}}')"
    #     fi

    #     DELETE_MARKER_COUNT=$(aws s3api --profile ${env[0]} list-object-versions --region ${!env[2]} \
    #         --bucket ${BUCKET_TO_DELETE} --query='{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}' \
    #         --output text  | grep -v ^None | wc -l)
    #     if [[ $DELETE_MARKER_COUNT > 0 ]]
    #     then
    #         aws s3api --profile ${env[0]} delete-objects --region ${!env[2]} \
    #             --bucket ${BUCKET_TO_DELETE} \
    #             --delete "$(aws s3api --profile ${env[0]} list-object-versions --region ${!env[2]} \
    #             --bucket ${BUCKET_TO_DELETE} --query='{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}')"
    #     fi
    #     log 'O' "deleting bucket ${BUCKET_TO_DELETE} in region ${!env[2]}.."
    #     read -p "Press any key to continue.."
    #     aws s3 --profile ${env[0]} rb --region ${!env[2]} s3://${BUCKET_TO_DELETE} --force
    # fi
    # log 'O' "deleting stack CDKToolkit in region ${!env[2]}.."
    # read -p "Press any key to continue.."
    # aws cloudformation --profile ${env[0]} delete-stack --region ${!env[2]} --stack-name CDKToolkit

done

log 'O' "---------------------------------------------------------"

log 'O' "Deleting all Secrets and SSM SecureString Parameters created as part of this pattern.."
read -p "Press any key to continue.."

aws secretsmanager delete-secret --profile pipeline-account --region ${COA_PIPELINE_REGION} --secret-id "github-token" --force-delete-without-recovery

# aws secretsmanager delete-secret --profile monitoring-account --region ${COA_MON_REGION} --secret-id "github-ssh-key" --force-delete-without-recovery

aws ssm delete-parameter --profile pipeline-account --region ${COA_PIPELINE_REGION} --name "/cdk-accelerator/pipeline-git-info"
COA_AMG_WORKSPACE_NAME=$(aws ssm get-parameter --profile pipeline-account --region ${COA_PIPELINE_REGION} \
    --name "/cdk-accelerator/amg-info" --with-decryption \
    --query "Parameter.Value" --output text | jq .amg.workspaceName | sed 's/"//g')
aws ssm delete-parameter --profile pipeline-account --region ${COA_PIPELINE_REGION} --name "/cdk-accelerator/amg-info"
aws ssm delete-parameter --profile pipeline-account --region ${COA_PIPELINE_REGION} --name "/cdk-accelerator/cdk-context"

aws ssm delete-parameter --profile monitoring-account --region ${COA_MON_REGION} --name "/cdk-accelerator/grafana-api-key"

log 'O' "Deleting Amazon Grafana API key.."
read -p "Press any key to continue.."

COA_AMG_WORKSPACE_ID=$(aws grafana list-workspaces --profile monitoring-account --region ${COA_MON_REGION} \
    --query "workspaces[?name=='${COA_AMG_WORKSPACE_NAME}'].id" \
    --output text)

aws grafana delete-workspace-api-key --profile monitoring-account --region ${COA_MON_REGION} \
    --key-name "grafana-operator-key" \
    --workspace-id $COA_AMG_WORKSPACE_ID

log 'G' "DONE!"