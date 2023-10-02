#!/bin/bash

set -e # exit when any command fails

SCRIPT_PATH=$(git rev-parse --show-toplevel)/helpers/multi-acc-new-eks-mixed-observability-pattern

source ${SCRIPT_PATH}/format-display.sh # format display
# source ${SCRIPT_PATH}/source-envs.sh # sets required environment variables

existingParam=$(aws ssm describe-parameters --profile pipeline-account --region ${COA_PIPELINE_REGION} --query "length(Parameters[?Name=='/cdk-accelerator/pipeline-git-info'])")
if [ $existingParam -eq 0 ]; then
    read -p "CodePipeline source GitHub Owner Name: " gitowner_input
    if [ -z "$gitowner_input" ]; then
        log 'R' "Input required."
        exit 1
    else
        gitOwner=$gitowner_input
    fi

    read -p "CodePipeline source GitHub Repo Name (default is cdk-aws-observability-accelerator): " gitRepoName_input
    if [ -z "$gitRepoName_input" ]; then
        gitRepoName="cdk-aws-observability-accelerator"
    else
        gitRepoName=$gitRepoName_input
    fi

    read -p "CodePipeline source GitHub Repo Branch Name (default is main): " gitBranch_input
    if [ -z "$gitBranch_input" ]; then
        gitBranch="main"
    else
        gitBranch=$gitBranch_input
    fi


    log 'O' "creating SSM SecureString parameter /cdk-accelerator/pipeline-git-info in ${COA_PIPELINE_REGION} region of pipeline-account (${COA_PIPELINE_ACCOUNT_ID}).."
    aws ssm put-parameter --profile pipeline-account --region ${COA_PIPELINE_REGION} \
    --type "SecureString" \
    --overwrite \
    --name "/cdk-accelerator/pipeline-git-info" \
    --description "CodePipeline source GitHub info" \
    --value '{
        "pipelineSource": {
            "gitOwner": "'${gitOwner}'",
            "gitRepoName": "'${gitRepoName}'",
            "gitBranch": "'${gitBranch}'"
        }
    }'
else
    log 'B' "SSM SecureString parameter /cdk-accelerator/pipeline-git-info exists in ${COA_PIPELINE_REGION} region of pipeline-account (${COA_PIPELINE_ACCOUNT_ID})."
fi

# Get GitHub Personal Access Token for CodePipeline source and create-secret in pipeline-account
existingSecret=$(aws secretsmanager list-secrets --profile pipeline-account --region ${COA_PIPELINE_REGION} --query "length(SecretList[?Name=='github-token'])")
if [ $existingSecret -eq 0 ]; then
    read -s -p "GitHub Personal Access Token for CodePipeline source: " gitpat_input
    if [ -z "$gitpat_input" ]; then
        log 'R' "Input required."
        exit 1
    else
        gitPat=$gitpat_input
    fi

    log 'O' "creating Secret github-token in ${COA_PIPELINE_REGION} region of pipeline-account (${COA_PIPELINE_ACCOUNT_ID}).."
    aws secretsmanager create-secret --profile pipeline-account --region ${COA_PIPELINE_REGION} \
        --name "github-token" \
        --description "GitHub Personal Access Token for CodePipeline to access GitHub account" \
        --secret-string "${gitPat}"
else
    log 'B' "Secret github-token exists in ${COA_PIPELINE_REGION} region of pipeline-account (${COA_PIPELINE_ACCOUNT_ID})."
fi

# Demonstration code for creating a new Secret in the monitoring account for private Git source for Argo CD in monitoring account.
# existingSecret=$(aws secretsmanager list-secrets --profile monitoring-account --region ${COA_MON_REGION} --query "length(SecretList[?Name=='github-ssh-key'])")
# if [ $existingSecret -eq 0 ]; then
# read -p "GitHub SSH PRIVATE key PEM filename along with path: " gitpemfile_input
#     if [ -z "$gitpemfile_input" ]; then
#         log 'R' "Input required."
#         exit 1
#     else
#         gitPemFile=$gitpemfile_input
#     fi

#     eval bash `git rev-parse --show-toplevel`/helpers/multi-acc-new-eks-mixed-observability-pattern/create-input-json-for-git-ssh-key.sh $gitPemFile > /tmp/input-json-for-git-ssh-key.json
#     # curl -sSL https://raw.githubusercontent.com/aws-observability/cdk-aws-observability-accelerator/main/helpers/create-input-json-for-git-ssh-key.sh | eval bash -s $gitpemfile_input > /tmp/input-json-for-git-ssh-key.json
#     log 'O' "creating Secret github-ssh-key in ${COA_MON_REGION} region of monitoring-account (${COA_MON_ACCOUNT_ID}).."
#     aws secretsmanager create-secret --profile monitoring-account --region ${COA_MON_REGION} \
#         --name "github-ssh-key" \
#         --description "SSH private key for ArgoCD authentication to GitHub repository" \
#         --cli-input-json file:///tmp/input-json-for-git-ssh-key.json
#     rm /tmp/input-json-for-git-ssh-key.json
# else
#     log 'B' "Secret github-ssh-key exists in ${COA_MON_REGION} region of monitoring-account (${COA_MON_ACCOUNT_ID})."
# fi

log 'G' "DONE!"