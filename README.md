# npm-hono-proxy

軽量な「許可範囲付き npm プロキシ & 監査ツール」。許可されない/安全でないと判断されたパッケージやバージョンを「存在しないもの」として扱い、`npm install` 時に `ETARGET` で気づけるようにします。加えて `audit` コマンドで範囲外依存を検出し、必要なら自動修正します。

## 使ってみる

1. プロキシサーバー起動
  ```pwsh
  npx npm-hono-proxy
  # → デフォルト: http://localhost:4873 で待受
  ```

2. 対象プロジェクトをプロキシに向ける（どれか1つ好みで）
  - `.npmrc` に `registry=http://localhost:4873`
  - `npm config set registry http://localhost:4873`
  - コマンド都度: `npm install --registry http://localhost:4873`
  - 環境変数: `$env:NPM_CONFIG_REGISTRY="http://localhost:4873"`

3. 依存インストール
  ```pwsh
  npm install
  ```
  許可外/隔離中バージョンは取得不可 → `ETARGET`

4. 範囲外依存を確認
  ```pwsh
  npx npm-hono-proxy audit
  ```

5. 自動修正したい場合
  ```pwsh
  npx npm-hono-proxy audit fix
  ```
  （`package.json` を書き換え、安全と判断できる候補へ揃える）

6. 再度インストール
  ```pwsh
  npm install
  ```

これで基本的な利用は完了です。

## 追加説明

### 隔離 (Quarantine) とは
新しく公開されたバージョンを一定期間「隔離」し、既定のタグ/時刻情報から安全と判断できるまでブロックします。隔離期間内のバージョンは存在しない扱い (`ETARGET`) になります。期間と挙動は後述のオプションで調整可能です。

### `audit` コマンド
現在の `package.json` に含まれる依存のうち、ポリシー/隔離条件により利用不可のものを列挙します。`audit fix` はその場で `package.json` を更新し、インストール可能な代替バージョンへ揃えます。（自動修正後は再インストールが必要）

## CLI オプション / 環境変数一覧

| 機能 | CLI 引数 | 環境変数 | 既定値 | 説明 |
|------|----------|----------|--------|------|
| ポート | `--port=<number>` | `PORT` | `4873` | HTTP 待受ポート |
| 隔離有効化 | `--quarantine-enabled=<true|false>` | `QUARANTINE_ENABLED` | `true` | 隔離機能オン/オフ |
| 隔離期間(分) | `--quarantine-minutes=<minutes>` | `QUARANTINE_MINUTES` | `30240` (21日) | 新規バージョンを隔離する長さ |
| 安全タグ不在時の処理 | `--quarantine-policy-on-no-safe=set-safe|fail` | `QUARANTINE_POLICY_ON_NO_SAFE` | `set-safe` | 安全タグが無い場合の挙動 |
| ログレベル | `--log-level=info|warn|error|silent` | `LOG_LEVEL` | （`--verbose` あり: `info`, なし: `warn`） | 出力詳細度 |
| ログ形式 | `--log-format=text|ndjson` | `LOG_FORMAT` | `text` | 構造化出力が欲しい場合 `ndjson` |
| 簡易冗長モード | `--verbose` | `VERBOSE` | `false` | 指定時は暗黙にレベル `info` |

補足:
1. CLI 引数が環境変数より優先されます。
2. 不正な数値（負など）は 0 以上に補正されます。
3. `audit fix` 実行時は内部的に `NPM_HONO_PROXY_AUDIT_FIX=true` が設定されます（手動指定不要）。

### 例: 隔離を7日、NDJSON ログで起動
```pwsh
npx npm-hono-proxy --quarantine-minutes=10080 --log-format=ndjson
```

### 例: ポートとログレベルを環境変数で指定
```pwsh
$env:PORT="5000"
$env:LOG_LEVEL="error"
npx npm-hono-proxy
```

## エラー挙動
- 許可外または隔離中のバージョンを取得しようとした場合: `ETARGET`
- ポリシー処理で異常があった場合: ログに `policy-error` などの理由が出力されます。

## 開発向けメモ
ローカルでリポジトリを触る際:
```pwsh
git clone https://github.com/D-ske104/npm-hono-proxy.git
cd npm-hono-proxy
npm install
npm run build
npx npm-hono-proxy
```

Playground や検証用スクリプト:
```pwsh
npm run play:dev   # 開発モード
npm run play:npx   # npx 経由シミュレーション
npm run play:bin   # bin/cli.js 直接
```

## 注意
このプロキシは安全性向上の補助を目的としたものです。隔離・監査ロジックは運用要件に合わせて十分に検証してください。
