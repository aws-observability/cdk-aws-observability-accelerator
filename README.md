# AWS Observability Accelerator for CDK

Welcome to the AWS Observability Accelerator for CDK!

The AWS Observability Accelerator for CDK is a set of opinionated modules
to help you set up observability for your AWS environments with AWS Native services and AWS-managed observability services such as Amazon Managed Service for Prometheus,Amazon Managed Grafana, AWS Distro for OpenTelemetry (ADOT) and Amazon CloudWatch.

We provide curated metrics, logs, traces collection, cloudwatch dashboard, alerting rules and Grafana dashboards for your EKS infrastructure, Java/JMX, NGINX based workloads and your custom applications.

## Single EKS Cluster AWS Native Observability Accelerator

![AWSNative-Architecture](https://github.com/aws-observability/cdk-aws-observability-accelerator/blob/main/docs/images/cloud-native-arch.png?raw=true)

## Singe EKS Cluster Open Source Observability Accelerator

![OpenSource-Architecture](https://raw.githubusercontent.com/aws-observability/cdk-aws-observability-accelerator/811ec42307d41f35f2fec95f2f2b8a20bddc7646/docs/images/CDK_Architecture_diagram.png)

## Patterns

The individual patterns can be found in the [`lib`](https://github.com/aws-observability/cdk-aws-observability-accelerator/tree/main/lib) directory.  Most of the patterns are self-explanatory, for some more complex examples please use this guide and docs/patterns directory for more information.

## Usage
Before proceeding, make sure [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) is installed on your machine.

To use the eks-blueprints and patterns module, you must have [Node.js](https://nodejs.org/en/) and [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) installed. You will also use `make` and `brew` to simplify build and other common actions. 

### Ubuntu Setup
Follow the below steps to setup and leverage cdk-aws-observability-accelerator in your Ubuntu Linux machine.

1. **Update the package list** 

    Update the package list to ensure you're installing the latest versions.

    ```bash
    sudo apt update
    ```

2. **Install make**

    ```bash
    sudo apt install make
    ```

3. **Install Node.js and npm**

    Install Node.js and npm using the NodeSource binary distributions.
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - &&\
    sudo apt-get install -y nodejs
    ```
    
    Note: The Node.js package from NodeSource includes npm

4. **Verify Node.js and npm Installation**

    Check the installed version of Node.js:

    ```bash
    node -v
    ```

    The output should be `v20.x.x`.

    Check the installed version of npm:

    ```bash
    npm -v
    ```

    The output should be a version greater than `9.7.x`.

    If your npm version is not `9.7.x` or above, update npm with the following command:

    ```bash
    sudo npm install -g npm@latest
    ```

    Verify the installed version by running `npm -v`.

5. Install brew on ubuntu by following instructions as detailed in [docs.brew.sh](https://docs.brew.sh/Homebrew-on-Linux)
   ```bash
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   Add Homebrew to your PATH
   ```
   test -d ~/.linuxbrew && eval "$(~/.linuxbrew/bin/brew shellenv)"
   test -d /home/linuxbrew/.linuxbrew && eval "$(/home/linuxbrew/.linux  brew/bin/brew shellenv)"
   test -r ~/.bash_profile && echo "eval \"\$($(brew --prefix)/bin/brew shellenv)\"" >> ~/.bash_profile
   echo "eval \"\$($(brew --prefix)/bin/brew shellenv)\"" >> ~/.profile
    
   ```

Post completing the above, continue from Step: [Repo setup](#repo-setup)

### Mac Setup:

Follow the below steps to setup and leverage `cdk-aws-observability-accelerator` in your local Mac laptop.

1. Install `make` and `node` using brew

```
brew install make
brew install node
```

2. Install `npm`

```
sudo npm install -g n
sudo n stable
```

3. Make sure the following pre-requisites are met:

- Node version is a current stable node version 18.x.

```bash
$ node -v
v20.3.1
```

Update (provided Node version manager is installed): `n stable`. May require `sudo`.

-  NPM version must be 8.4 or above:

```bash
$ npm -v
9.7.2
```

Updating npm: `sudo n stable` where stable can also be a specific version above 8.4. May require `sudo`.


### Repo setup
1. Clone the `cdk-aws-observability-accelerator` repository

```
git clone https://github.com/aws-observability/cdk-aws-observability-accelerator.git
``` 

PS: If you are contributing to this repo, please make sure to fork the repo, add your changes and create a PR against it.

2. Once you have cloned the repo, you can open it using your favourite IDE and run the below commands to install the dependencies and build the existing patterns.

- Install project dependencies.

```
make deps
```

- To view patterns that are available to be deployed, execute the following:

```
make build
```

- To list the existing CDK AWS Observability Accelerator Patterns

```
make list
```

Note: Some patterns have a hard dependency on AWS Secrets (for example GitHub access tokens). Initially you will see errors complaining about lack of the required secrets. It is normal. At the bottom, it will show the list of patterns which can be deployed, in case the pattern you are looking for is not available, it is due to the hard dependency which can be fixed by following the docs specific to those patterns.

```
To work with patterns use:
	$ make pattern <pattern-name> <list | deploy | synth | destroy>
Example:
	$ make pattern single-new-eks-opensource-observability deploy

Patterns:

	existing-eks-mixed-observability
	existing-eks-opensource-observability
	single-new-eks-awsnative-observability
	single-new-eks-cluster
	single-new-eks-graviton-opensource-observability
	single-new-eks-mixed-observability
	single-new-eks-opensource-observability
```

- Bootstrap your CDK environment.

```
npx cdk bootstrap
```

- You can then deploy a specific pattern with the following:

```
make pattern single-new-eks-opensource-observability deploy
```

# Developer Flow

## Modifications

All files are compiled to the dist folder including `lib` and `bin` directories. For iterative development (e.g. if you make a change to any of the patterns) make sure to run compile:

```bash
make compile
```

The `compile` command is optimized to build only modified files and is fast. 

## New Patterns

To create a new pattern, please follow these steps:

1. Under lib create a folder for your pattern, such as `<pattern-name>-construct`. If you plan to create a set of patterns that represent a particular subdomain, e.g. `security` or `hardening`, please create an issue to discuss it first. If approved, you will be able to create a folder with your subdomain name and group your pattern constructs under it. 
2. Blueprints generally don't require a specific class, however we use a convention of wrapping each pattern in a plain class like `<Pattern-Name>Construct`. This class is generally placed in `index.ts` under your pattern folder. 
3. Once the pattern implementation is ready, you need to include it in the list of the patterns by creating a file `bin/<pattern-name>.ts`. The implementation of this file is very light, and it is done to allow patterns to run independently.

Example simple synchronous pattern:
```typescript
import SingleNewEksOpenSourceobservabilityConstruct from '../lib/single-new-eks-opensource-observability-construct';
import { configureApp } from '../lib/common/construct-utils';

const app = configureApp();

new SingleNewEksOpenSourceobservabilityConstruct(app, 'single-new-eks-opensource');
 // configureApp() will create app and configure loggers and perform other prep steps
```

## Security

See [CONTRIBUTING](./CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
