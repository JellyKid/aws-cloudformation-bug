import * as cdk from 'aws-cdk-lib';
import { AutoScalingGroup } from 'aws-cdk-lib/aws-autoscaling';
import { InstanceClass, InstanceSize, InstanceType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { AsgCapacityProvider, AwsLogDriver, Capability, Cluster, ContainerDefinition, ContainerImage, Ec2Service, Ec2TaskDefinition, EcsOptimizedImage, LinuxParameters } from 'aws-cdk-lib/aws-ecs';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class AwsCloudformationBugStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //get VPC
    const vpc = Vpc.fromLookup(this, "VPC", {isDefault: true});

    //create test bucket that will be removed upon stack destroy
    const bucketName = 'test-bucket-cf-bug';
    const bucket = new Bucket(this, "test-bucket", {
      bucketName,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    })

    //create cluster /w asg
    const myCluster = new Cluster(this, "test-cluster", {vpc});
    const autoScalingGroup = new AutoScalingGroup(this, "asg", {
      vpc,
      instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
      machineImage: EcsOptimizedImage.amazonLinux2023(),
    });
    const capacityProvider = new AsgCapacityProvider(this, 'capacity-provider', {
      autoScalingGroup,
      enableManagedTerminationProtection: false,
      capacityProviderName: 'test-capacity-provider'
    });
    myCluster.addAsgCapacityProvider(capacityProvider);

    //get container image
    const imageRepository  = Repository.fromRepositoryName(this,'mountpoint-ecr','public.ecr.aws/n1i9q1k0/mountpoint-s3');
    const image = ContainerImage.fromEcrRepository(imageRepository,'latest');

    //set linux params for container
    const linuxParameters = new LinuxParameters(this, 'container-linux-params');
    linuxParameters.addCapabilities(Capability.SYS_ADMIN);
    linuxParameters.addDevices({
      hostPath: "/dev/fuse",
      containerPath: "/dev/fuse"
    })

    //create task & container definition
    const taskDefinition = new Ec2TaskDefinition(this, 'main-task');
    const containerDefinition = new ContainerDefinition(this, 'mountpoint-contiainer',{
      taskDefinition,
      image,
      memoryReservationMiB: 256,
      containerName: 'mountpoint',
      hostname: 'mountpoint',
      linuxParameters,
      logging: new AwsLogDriver({streamPrefix: 'mountpoint-container'}),
      interactive: true,
      pseudoTerminal: true,
      command: ["--allow-delete","--allow-overwrite",bucketName,"/mnt"]      
    })

    //grant taskrole readwrite access to bucket
    bucket.grantReadWrite(taskDefinition.taskRole);

    //create service
    const mainService = new Ec2Service(this, 'mountpoint-service', {
      serviceName: 'mountpoint',
      cluster: myCluster,
      taskDefinition,
      enableExecuteCommand: true,
      daemon: true
    });    
  }
}
