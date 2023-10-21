interface Statement {
    Effect: string;
    Action: string | string[];
    Resource: string | string[];
}

export function getCodeBuildPolicyDocument() : Statement[] {
    const result: Statement[] = [
        {
            "Effect": "Allow",
            "Action": [
                "sts:AssumeRole",
                "secretsmanager:GetSecretValue",
                "secretsmanager:DescribeSecret",
                "cloudformation:*",
                "ssm:GetParameter",
                "ssm:PutParameter",
                "ssm:DescribeParameter"
            ],
            "Resource": "*"
        }
    ];
    return result;
}