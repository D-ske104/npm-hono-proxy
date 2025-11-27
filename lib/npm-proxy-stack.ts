import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';

export class NpmProxyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 明示的 IAM ロール（ManagedPolicy を避けて警告抑制）
    const lambdaRole = new iam.Role(this, 'NpmProxyLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for NpmProxyFunction with inline log policy',
    });
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: ['arn:aws:logs:*:*:*'],
    }));

    // Lambda環境変数の動的取得（デプロイ時の export で上書き可能）
    const upstreamRegistry = process.env.UPSTREAM_REGISTRY || 'https://registry.npmjs.org';
    const quarantineDaysRaw = process.env.QUARANTINE_DAYS;
    let quarantineDays = 7;
    if (quarantineDaysRaw) {
      const parsed = parseInt(quarantineDaysRaw, 10);
      if (Number.isFinite(parsed)) {
        quarantineDays = Math.min(365, Math.max(0, parsed));
      }
    }

    // Lambda関数の定義（カスタムロールを使用）
    const proxyFunction = new nodejs.NodejsFunction(this, 'NpmProxyFunction', {
      runtime: lambda.Runtime.NODEJS_22_X, // 最新のLTS推奨
      entry: 'lambda/index.ts', // Lambdaコードのパス
      handler: 'handler',
      architecture: lambda.Architecture.ARM_64, // コストパフォーマンス重視でGravitonを選択
      timeout: cdk.Duration.minutes(15), // npm installは時間がかかることがあるため最大値へ
      memorySize: 512, // ストリーム処理の安定性のため少し多めに
      bundling: {
        minify: true, // コードを軽量化
        sourceMap: true,
      },
      environment: {
        UPSTREAM_REGISTRY: upstreamRegistry,
        QUARANTINE_DAYS: String(quarantineDays),
      },
      role: lambdaRole,
    });

    // Function URLの発行
    const functionUrl = proxyFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE, // パブリックアクセス（npmクライアント用）
      
      // ★最重要: 6MB制限を突破し、HonoのstreamHandleに対応させる設定
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM, 
    });

    // ===== Route53 + CloudFront (custom domain: npm.an.kusatake.dev) =====
    const HOSTED_ZONE_ID = process.env.HOSTED_ZONE_ID
    const HOSTED_ZONE_NAME = process.env.HOSTED_ZONE_NAME
    const DOMAIN_NAME = process.env.DOMAIN_NAME ?? `npm.${HOSTED_ZONE_NAME}`

    if (!HOSTED_ZONE_ID || !HOSTED_ZONE_NAME) {
      throw new Error('HOSTED_ZONE_ID and HOSTED_ZONE_NAME must be set in environment variables');
    }

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: HOSTED_ZONE_ID,
      zoneName: HOSTED_ZONE_NAME,
    });

    // CloudFront は us-east-1 の ACM 証明書が必要
    // 推奨: us-east-1 に別スタックで Certificate を作成し、ARN を渡す
    const CERT_ARN = process.env.CERT_ARN;
    if (!CERT_ARN) throw new Error('CERT_ARN must be set in environment variables'); 
    const certificate: acm.ICertificate = acm.Certificate.fromCertificateArn(this, 'NpmProxyCertImported', CERT_ARN);

    // Function URL を CloudFront のオリジンに設定（Token対応のため文字列操作は Fn で行う）
    const urlParts = cdk.Fn.split('/', functionUrl.url);
    const originHost = cdk.Fn.select(2, urlParts); // 'https:' '','host', 'path...'
    // クエリはもう隔離期間オーバーライドに利用しないため forward / cache キーから除外
    const minimalOriginRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'NoQueryOriginPolicy', {
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.none(),
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.none(),
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
    });

    const baseCachePolicy = new cloudfront.CachePolicy(this, 'BaseCachePolicy', {
      cachePolicyName: 'npm-proxy-base',
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      defaultTtl: cdk.Duration.hours(1),
      maxTtl: cdk.Duration.hours(24),
      minTtl: cdk.Duration.seconds(0),
      enableAcceptEncodingBrotli: true,
      enableAcceptEncodingGzip: true,
    });

    const distribution = new cloudfront.Distribution(this, 'NpmProxyDistribution', {
      domainNames: [DOMAIN_NAME],
      certificate,
      defaultBehavior: {
        origin: new origins.HttpOrigin(originHost),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        // パスのみでバリエーション、クエリは不要
        originRequestPolicy: minimalOriginRequestPolicy,
        cachePolicy: baseCachePolicy,
      },
    });

    // Route53 A レコード（ALIAS → CloudFront）
    new route53.ARecord(this, 'NpmProxyAlias', {
      zone: hostedZone,
      recordName: DOMAIN_NAME.replace(`.${HOSTED_ZONE_NAME}`, ''),
      target: route53.RecordTarget.fromAlias(new route53targets.CloudFrontTarget(distribution)),
    });

    // デプロイ後にURLを表示
    new cdk.CfnOutput(this, 'NpmProxyFunctionUrl', {
      value: functionUrl.url,
      description: 'Raw function URL (origin for CloudFront)'
    });
    new cdk.CfnOutput(this, 'NpmProxyCustomDomain', {
      value: `https://${DOMAIN_NAME}/`,
      description: 'Custom domain for npm registry',
    });

  }
}
