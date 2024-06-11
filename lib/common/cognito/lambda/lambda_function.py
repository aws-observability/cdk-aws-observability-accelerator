import json
import os
import boto3

def lambda_handler(event, context):
    print("Received event: " + json.dumps(event, indent=2))
    
    ssmclient = boto3.client('ssm')
    
    try:    
        allowed_domains_list = os.environ.get("ALLOWED_DOMAINS_LIST", "example.com")

    except Exception as e:
        print("Error in reading the SSM Parameter Store : {}".format(str(e)))   
        
    triggerSource = event['triggerSource']
    
    # Split the email address so we can compare domains
    emailId = event['request']['userAttributes']['email']
    address = emailId.split('@')
    
    emailDomain = address[1]    
    
    print("Running the Validation for {} flow".format(triggerSource))
    
    if triggerSource == 'PreSignUp_SignUp':
        # It sets the user pool autoConfirmUser flag after validating the email domain
        event['response']['autoConfirmUser'] = False

        # This example uses a custom attribute 'custom:domain'
        if emailDomain not in allowed_domains_list:
            raise Exception("Cannot register users with email domains other than allowed domains list={}".format(allowed_domains_list))
    else:
        print("triggerSource={} is incorrect".format(triggerSource))

    #print("Received event: " + json.dumps(event, indent=2))
    
    return event