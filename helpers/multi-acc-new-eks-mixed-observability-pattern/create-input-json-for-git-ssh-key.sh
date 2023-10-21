#!/bin/bash
set -aue

PEM_FILE="${1}"
URL_TEMPLATE="git@github" # all of GitHub

secretstring() {
    # echo 'Generating secret file using' $PEM_FILE
    sshPrivateKey=$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}'  $PEM_FILE)

    echo -n ""
    echo "{"
    echo "    \"sshPrivateKey\": \"${sshPrivateKey}\","
    echo "    \"url\": \"${URL_TEMPLATE}\""
    echo -n "}"
}

echo "{ \"SecretString\": `secretstring | jq -Rs .` }"