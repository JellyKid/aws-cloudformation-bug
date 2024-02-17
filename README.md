# Cloudformation ECS Task Bug
There seems to be an issue with CloudFormation where it will generate an empty entrypoint for ECS tasks. I've determined that it's related to the **command** parameter for the task. It is not a CDK issue though, as the CDK produces a YAML CF template that does not contain an empty entrypoint.

The output directory in this repo contains the output from `cdk synth` and the task definition's JSON file created by CloudFormation for both the working and broken(main) branches. 

The main/master(broken) branch exhibits this behavior and the service/task will fail. To fix the issue, specifically look at the containerDefinition **command** parameter:

    command: ["--allow-delete","--allow-overwrite",bucketName,"/mnt"]

If I remove the first 2 entries, like in the **working** branch:

    command: [bucketName,"/mnt"]

The CDK will produce a very similar yaml template, missing those 2 entries. When uploaded to CloudFormation, it will not create an empty entrypoint and the service will start just fine.
  

# Steps to reproduce the issue
Download one of the broken or working CF templates from the output directory and upload it to CF manually.

OR 

Clone this repo, pick the branch you want to test **main**(broken) or **working**, and run `cdk deploy`.   

# Error messages
You should see weird errors on the service/task when it attempts to start like:

`ECS CannotStartContainerError: Error response from daemon: failed to create shim task: OCI runtime create failed`