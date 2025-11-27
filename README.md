# npm-hono-proxy

Hono + AWS Lambda（Function URL, RESPONSE_STREAM）で動作する npm Registry プロキシです。最新リリースの隔離期間を設け、危険な `latest` を一時的に避けられます。

## 特長
- ストリームで `.tgz` を透過返却
- 新着版を `quarantine-latest` に退避し、`latest` を安全な版へ再設定
- 環境変数とパスプレフィックスで隔離期間を柔軟制御

## デプロイ（CDK）
```zsh
## デプロイ（CDK）

CloudFront + Route53 + 既存 ACM 証明書 (us-east-1) を前提にしています。証明書は手動で発行し ARN を環境変数 `CERT_ARN` に渡します。

### 1. 依存インストール / ビルド
```zsh
npm install
npm run build
```

### 2. CDK Bootstrap（初回のみ）
```zsh
npx cdk bootstrap
```

### 3. us-east-1 で ACM 証明書を手動発行
```zsh
aws acm request-certificate \
	--region us-east-1 \
	--domain-name "npm.<HostedZoneName>" \
	--validation-method DNS \
	--options CertificateTransparencyLoggingPreference=ENABLED

# CNAME 検証レコード確認
aws acm describe-certificate \
	--region us-east-1 \
	--certificate-arn <CERT_ARN> \
	--query 'Certificate.DomainValidationOptions'

# Route53 に検証レコード追加（HostedZoneId 差し替え）
aws route53 change-resource-record-sets \
	--hosted-zone-id <HOSTED_ZONE_ID> \
	--change-batch '{"Changes":[{"Action":"UPSERT","ResourceRecordSet":{"Name":"<NAME>","Type":"CNAME","TTL":300,"ResourceRecords":[{"Value":"<VALUE>"}]}}]}'

# 発行状態確認 (ISSUED になるまで待機)
aws acm describe-certificate \
	--region us-east-1 \
	--certificate-arn <CERT_ARN> \
	--query 'Certificate.Status'
```

### 4. 環境変数をセットしてデプロイ
```zsh
export CERT_ARN=arn:aws:acm:us-east-1:XXXXXXXXXXXX:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export HOSTED_ZONE_ID=ZXXXXXXXXXXXXXXX
export HOSTED_ZONE_NAME=example.com
export DOMAIN_NAME=npm.example.com   # 省略時は npm.<HOSTED_ZONE_NAME>

npx cdk deploy NpmProxyStack
```

### 5. レジストリ設定
CloudFront のカスタムドメイン（例: `https://npm.example.com/`）を `.npmrc` の `registry` に指定します。
npm install
## 環境変数
- `UPSTREAM_REGISTRY`: 上流 Registry URL（既定 `https://registry.npmjs.org`）
- `QUARANTINE_DAYS`: 既定隔離日数（既定 `7`）
- `CERT_ARN`: us-east-1 の ACM 証明書 ARN（必須）
- `HOSTED_ZONE_ID`: Route53 HostedZone の ID（必須）
- `HOSTED_ZONE_NAME`: HostedZone のドメイン名（必須）
- `DOMAIN_NAME`: 公開する完全修飾ドメイン（任意。省略時 `npm.<HOSTED_ZONE_NAME>`）
npx cdk deploy
## 使い方（npm クライアント）
`.npmrc` に CloudFront カスタムドメインを設定します。
```ini
registry=https://npm.example.com/
```
`.npmrc` に Function URL を設定します。
```ini
### 隔離期間指定（パス方式）
単位ごとの 3 つのプレフィックスを用意し、同時利用や合成は不可（いずれか 1 つのみ）。

| 単位 | 形式 | 意味 | クランプ | 換算 | 例 |
|------|------|------|---------|------|----|
| 日   | `/d/<days>/`    | 日数隔離 | 0〜365 | そのまま | `/d/7/` |
| 時間 | `/h/<hours>/`   | 時間隔離 | 0〜8760 | `hours / 24` 日 | `/h/48/` (=2日) |
| 分   | `/m/<minutes>/` | 分隔離 | 0〜525600 | `minutes / (24*60)` 日 | `/m/180/` (=0.125日) |

`.npmrc` 例:
```ini
registry=https://npm.example.com/d/7/     ; 7 日隔離
registry=https://npm.example.com/h/48/    ; 48 時間 (2 日)
registry=https://npm.example.com/m/180/   ; 180 分 (0.125 日)
registry=https://npm.example.com/         ; 既定 QUARANTINE_DAYS 使用
```

ルール:
- プレフィックスは 1 種類のみ。入れ子や合成（例 `/d/7/h/12/`）は不可。
- 数値が不正 (NaN / 負数) の場合は既定値 `QUARANTINE_DAYS` を採用。
- スコープ付きパッケージにも対応: `/d/7/@scope/name`。
- 旧クエリパラメータ方式 (`?d=...&h=...`) は廃止済み。

## 動作概要
1. パッケージメタ（JSON）取得時:
	- `dist-tags.latest` が隔離期間未満 → `dist-tags.quarantine-latest` へ退避
	- 隔離期間外で最も新しい版を `latest` に再設定
	- 安全版が存在しない場合は `latest` を削除
2. `.tgz` はストリームで透過返却

### 内部実装メモ（精度）
ユーザー指定の隔離期間は最小単位「分」に正規化して内部保持し、判定直前に日数へ変換しています。
これにより短時間（数分〜数時間）指定時の丸め誤差を低減し、`/h/` や `/m/` プレフィックスでも一貫した比較精度を確保します。

## 注意事項
- 期待外の JSON 形は検証スキップし透過返却
- レスポンスヘッダで簡易キャッシュ制御: メタ JSON は `Cache-Control: public, max-age=300`、`.tgz` は `public, max-age=86400, immutable`
- CloudFront CachePolicy は単一（パス差異のみ）だが、ヘッダで TTL を差別化
- ETag / If-None-Match など高度な再検証は未実装
- `quarantine-latest` タグは独自拡張（公式 npm 仕様外）
- CloudFront 設定変更の反映には時間がかかる場合あり

## 今後の拡張案
- CloudFront のパスパターン別キャッシュ分離（`.tgz` 長期 / JSON 短期）
- ETag / Conditional Requests 対応
- バージョン単位ブラックリスト
- 監視メトリクス / ダッシュボード整備
