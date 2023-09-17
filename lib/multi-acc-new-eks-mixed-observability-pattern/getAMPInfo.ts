import { STS, SharedIniFileCredentials, config, Credentials, Amp } from 'aws-sdk';

// function to get SSM Parameterstor Securestring value
export async function getAMPInfo(assumeRoleArn: string, ampAlias: string): Promise<string> {  

    let workspaceId: string[];    
    let prometheusEndpoint: string;
    prometheusEndpoint='';

    
    const profileCredentials = new SharedIniFileCredentials({ profile: "monitoring-account" });
    config.credentials = profileCredentials;

    const sts = new STS({ credentials: profileCredentials });
  
    await sts.assumeRole({ RoleArn: assumeRoleArn, RoleSessionName: 'AssumeRoleSession' }, (err, data) => {
        if (err) {
            console.error('Error assuming role:', err);
        }

        // Create a new AWS SDK instance with the assumed role's credentials
        const assumedRoleCredentials = new Credentials({
            accessKeyId: data.Credentials!.AccessKeyId,
            secretAccessKey: data.Credentials!.SecretAccessKey,
            sessionToken: data.Credentials!.SessionToken,
        })

        const amp = new Amp({ credentials: assumedRoleCredentials });

        const aliasParam = {
            alias: ampAlias,
            maxResults: 1
        };

        amp.listWorkspaces(aliasParam, (err, data) => {
            if (err) {
                console.error('ERROR with', aliasParam.alias, '-', err);
            } else {
                if (data.workspaces) {
                    workspaceId = data.workspaces.map(workspace => workspace.workspaceId)                    
                    // console.log(`workspaceId: ${workspaceId}`);
                } else {
                    console.error(`workspaceId '${aliasParam.alias}' not found.`);
                }
            }
            });

        const idParam = {
            workspaceId: workspaceId[0],
        };
      
        amp.describeWorkspace(idParam, (err, data) => {
        if (err) {
            console.error('ERROR with', idParam.workspaceId, '-', err);
        } else {
            if (data.workspace && data.workspace.prometheusEndpoint) {
                prometheusEndpoint = data.workspace.prometheusEndpoint;
                // console.log(`prometheusEndpoint: ${prometheusEndpoint}`);
            } else {
                console.error(`workspaceId '${idParam.workspaceId}' not found.`);
            }
        }
        });

    }).promise();    

    return prometheusEndpoint;
}