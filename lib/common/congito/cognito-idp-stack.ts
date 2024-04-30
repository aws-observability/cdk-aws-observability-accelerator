import * as cdk from 'aws-cdk-lib';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';

export default class CognitoIdpStack extends cdk.Stack {

    public readonly userPoolOut: cognito.UserPool;
    public readonly userPoolClientOut: cognito.UserPoolClient;
    public readonly userPoolDomainOut: cognito.UserPoolDomain;
    
    constructor(scope: Construct, id: string, subDomain: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const lambdaExecutionRole = new iam.Role(this, 'Lambda Execution Role', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        });

        lambdaExecutionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));
        lambdaExecutionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMReadOnlyAccess"));     
        
        const authChallengeFn = new lambda.Function(this, 'authChallengeFn', {
            runtime: lambda.Runtime.PYTHON_3_12,
            code: lambda.Code.fromAsset('./lib/common/cognito/lambda'),
            handler: 'lambda_function.lambda_handler',
            role: lambdaExecutionRole,
            environment: {
                "ALLOWED_DOMAINS_LIST": blueprints.utils.valueFromContext(scope, "allowed.domains.list", "amazon.com")
            }
        });


        // Cognito User Pool
        const userPool = new cognito.UserPool(this, 'CognitoIDPUserPool', {
            userPoolName: 'CognitoIDPUserPool',
            selfSignUpEnabled: true,
            signInAliases: {
                email: true,
                username: true
            },
            standardAttributes: {
                email: {
                    mutable: true,
                    required: true
                },
                givenName: {
                    mutable: true,
                    required: true
                },
                familyName: {
                    mutable: true,
                    required: true
                }
            },
            lambdaTriggers: {
                preSignUp: authChallengeFn,
                preAuthentication: authChallengeFn,
            },            
        });
        
        
        // Output the User Pool ID

        this.userPoolOut = userPool;
        
        new cdk.CfnOutput(this, 'CognitoIDPUserPoolOut', {
            value: userPool.userPoolId,
            exportName: 'CognitoIDPUserPoolId'
        });
        
        new cdk.CfnOutput(this, 'CognitoIDPUserPoolArnOut', {
            value: userPool.userPoolArn,
            exportName: 'CognitoIDPUserPoolArn'
        });


        // We will ask the IDP to redirect back to our domain's index page
        const redirectUri = `https://${subDomain}/oauth2/idpresponse`;
      
        // Configure the user pool client application 
        const userPoolClient = new cognito.UserPoolClient(this, 'CognitoAppClient', {
            userPool,
            authFlows: {
                userPassword: true
            },
            oAuth: {
                flows: {
                    authorizationCodeGrant: true
                },
                scopes: [
                    cognito.OAuthScope.OPENID
                ],
                callbackUrls: [redirectUri]
                // TODO - What about logoutUrls?
            },
            generateSecret: true,
            userPoolClientName: 'Web',
            supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO]
        });

        // Output the User Pool App Client ID
        this.userPoolClientOut = userPoolClient;

        new cdk.CfnOutput(this, 'CognitoIDPUserPoolClientOut', {
            value: userPoolClient.userPoolClientId,
            exportName: 'CognitoIDPUserPoolClientId'
        });

        // Add the domain to the user pool
        const randomText = (Math.random() + 1).toString(36).substring(7);
        const userPoolDomain = userPool.addDomain('CognitoDomain', {
            cognitoDomain: {
                domainPrefix: `my-cdk-blueprint-${randomText}`,
            },
        });

        // Output the User Pool App Client ID

        this.userPoolDomainOut = userPoolDomain;
    
        new cdk.CfnOutput(this, 'CognitoIDPUserPoolDomainOut', {
            value: userPoolDomain.domainName,
            exportName: 'CognitoIDPUserPoolDomain'
        });
        
    }
}