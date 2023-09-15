#!/bin/bash

export COA_PIPELINE_ACCOUNT_ID=$(aws configure get sso_account_id --profile pipeline-account)
export COA_PIPELINE_REGION=$(aws configure get region --profile pipeline-account)

export COA_PROD1_ACCOUNT_ID=$(aws configure get sso_account_id --profile prod1-account)
export COA_PROD1_REGION=$(aws configure get region --profile prod1-account)

export COA_PROD2_ACCOUNT_ID=$(aws configure get sso_account_id --profile prod2-account)
export COA_PROD2_REGION=$(aws configure get region --profile prod2-account)

export COA_MON_ACCOUNT_ID=$(aws configure get sso_account_id --profile monitoring-account)
export COA_MON_REGION=$(aws configure get region --profile monitoring-account)