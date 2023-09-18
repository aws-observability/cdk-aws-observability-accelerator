import { STS, SharedIniFileCredentials, config, Credentials, Amp } from 'aws-sdk';

// function to get SSM Parameterstor Securestring value
export async function getAMPInfo(awsProfile: string, assumeRoleArn: string, ampAlias: string): Promise<string> {  

    let workspaceIds: string[];    
    let prometheusEndpoint: string;
    prometheusEndpoint='';


    config.update({
        region: 'us-east-1'
    });
    
    // const profileCredentials = new SharedIniFileCredentials({ profile: awsProfile });
    // config.credentials = profileCredentials;
    // config.region = "us-west-2"

    // process.env.AWS_SDK_LOAD_CONFIG = '1';
    // const sts = new STS({ credentials: profileCredentials });
    const sts = new STS();
  
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
                    const workspaceIds = data.workspaces.map(workspace => workspace.workspaceId);
        
                    // Loop through workspaceIds and describe each workspace
                    workspaceIds.forEach(workspaceId => {
                        const idParam = {
                            workspaceId: workspaceId,
                        };
        
                        amp.describeWorkspace(idParam, (err, data) => {
                            if (err) {
                                console.error('ERROR with', idParam.workspaceId, '-', err);
                            } else {
                                if (data.workspace && data.workspace.prometheusEndpoint) {
                                    const prometheusEndpoint = data.workspace.prometheusEndpoint;
                                    console.log(`prometheusEndpoint for workspaceId ${idParam.workspaceId}: ${prometheusEndpoint}`);
                                } else {
                                    console.error(`workspaceId '${idParam.workspaceId}' not found.`);
                                }
                            }
                        });
                    });
                } else {
                    console.error(`workspaceId '${aliasParam.alias}' not found.`);
                }
            }
        });
        

        // amp.listWorkspaces(aliasParam, (err, data) => {
        //     if (err) {
        //         console.error('ERROR with', aliasParam.alias, '-', err);
        //     } else {
        //         if (data.workspaces) {
        //             workspaceIds = data.workspaces.map(workspace => workspace.workspaceId)       
        //             workspaceIds.forEach(workspaceId => {
        //                 const idParam = {
        //                     workspaceId: workspaceId,
        //                 };                                 
        //             // console.log(`workspaceId: ${workspaceId}`);

        //             amp.describeWorkspace(idParam, (err, data) => {
        //                 if (err) {
        //                     console.error('ERROR with', idParam.workspaceId, '-', err);
        //                 } else {
        //                     if (data.workspace && data.workspace.prometheusEndpoint) {
        //                         const prometheusEndpoint = data.workspace.prometheusEndpoint;
        //                         console.log(`prometheusEndpoint for workspaceId ${idParam.workspaceId}: ${prometheusEndpoint}`);
        //                     } else {
        //                         console.error(`workspaceId '${idParam.workspaceId}' not found.`);
        //                     }
        //                 }
        //             });
        //         } else {
        //             console.error(`workspaceId '${aliasParam.alias}' not found.`);
        //         }                                        
        //         // } else {
        //         //     console.error(`workspaceId '${aliasParam.alias}' not found.`);
        //         // }
        //     }
        //     });

        // const idParam = {
        //     workspaceId: workspaceId,
        // };
      
        // amp.describeWorkspace(idParam, (err, data) => {
        // if (err) {
        //     console.error('ERROR with', idParam.workspaceId, '-', err);
        // } else {
        //     if (data.workspace && data.workspace.prometheusEndpoint) {
        //         prometheusEndpoint = data.workspace.prometheusEndpoint;
        //         // console.log(`prometheusEndpoint: ${prometheusEndpoint}`);
        //     } else {
        //         console.error(`workspaceId '${idParam.workspaceId}' not found.`);
        //     }
        // }
        // });

    }).promise();    

    return prometheusEndpoint;
}