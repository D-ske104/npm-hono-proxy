# npm-hono-proxy

軽量な「許可範囲付き npm プロキシ」。許可されない/安全でないと判断されたパッケージやバージョンを「存在しないもの」として扱い、`npm install` 時に `ETARGET` で気づけるようにします。

## 特徴

- **軽量**: Hono + Node.js で動作するシンプルなプロキシサーバー
- **隔離 (Quarantine)**: 新しく公開されたバージョンを一定期間「隔離」し、安全と判断できるまでブロックします。
- **ETARGET エラー**: 隔離中のバージョンを指定した場合、存在しないものとして振る舞うため、クライアント側で即座に気づけます。

## 使ってみる

### 1. プロキシサーバー起動

```pwsh
npx npm-hono-proxy
# → デフォルト: http://localhost:4873 で待受
```

### 2. 対象プロジェクトをプロキシに向ける

以下のいずれかの方法で、npm クライアントの参照先をローカルプロキシに変更します。

- **`.npmrc` に設定 (推奨)**
  プロジェクトルートの `.npmrc` に以下を記述します。
  ```ini
  registry=http://localhost:4873/
  ```

- **コマンド実行時に指定**
  ```pwsh
  npm install --registry http://localhost:4873
  ```

- **環境変数で指定**
  ```pwsh
  $env:NPM_CONFIG_REGISTRY="http://localhost:4873"
  ```

### 3. 依存インストール

通常通りインストールを行います。

```pwsh
npm install
```

もし `package.json` で指定されたバージョンが「隔離期間中」であれば、プロキシはメタデータからそのバージョンを除外して返します。結果として npm はそのバージョンを見つけられず、`ETARGET` エラーになります。

## CLI オプション / 環境変数一覧

| 機能 | CLI 引数 | 環境変数 | 既定値 | 説明 |
|------|----------|----------|--------|------|
| ポート | `--port=<number>` | `PORT` | `4873` | HTTP 待受ポート |
| 上流レジストリ | `--upstream=<url>` | `UPSTREAM` | `https://registry.npmjs.org` | 取得元の Registry ベースURL |
| 隔離期間(分) | `--quarantine-minutes=<minutes>` | `QUARANTINE_MINUTES` | `30240` (21日) | 新規バージョンを隔離する長さ |
| ログ形式 | `--log-format=text|ndjson` | `LOG_FORMAT` | `text` | 構造化出力が欲しい場合 `ndjson` |

### 起動例

```pwsh
# ポート 5000、隔離期間 7日 (10080分) で起動
npx npm-hono-proxy --port=5000 --quarantine-minutes=10080
```

## 仕組み

1. **JSON リクエストの介入**: `application/json` ヘッダを持つメタデータ取得リクエストのみを処理します。
2. **メタデータ フィルタリング**: 上流レジストリから取得した JSON の `time` (公開日時) をチェックし、`QUARANTINE_MINUTES` 以内に公開されたバージョンを `versions` および `dist-tags` から削除します。
3. **その他はパススルー**: `.tgz` ファイルのダウンロードや、JSON 以外のリクエストは上流へリダイレクト (302) します。

## 開発向けメモ

ローカルでリポジトリを触る際:

```pwsh
git clone https://github.com/D-ske104/npm-hono-proxy.git
cd npm-hono-proxy
npm install
npm run build
npm run dev
```

## FAQ

[FAQ](./docs/FAQ.md)
