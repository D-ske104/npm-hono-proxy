# npm-hono-proxy

NPM Registry のメタデータだけを安全化するローカルプロキシです。`.tgz` 等の実ファイルは本家へリダイレクトし、`dist-tags` を隔離ポリシーに基づいて書き換えます。

## 起動例

```zsh
npx npm-hono-proxy
```

## セットアップ

```zsh
npm install
npm run build    # tsdown で ESM を dist に出力（dist/index.js）
```

開発起動（ホットなしのシンプル起動）:

```zsh
npm run dev      # tsx で直接 src/index.ts を起動
```

ビルド成果物で起動:

```zsh
node dist/index.js
```

## 隔離ポリシーの設定

環境変数または CLI 引数で設定できます。未指定時は「既定値」が適用されます。

| 設定項目 | 環境変数 | CLI 引数 | 既定値 | 挙動 |
|---|---|---|---|---|
| ポート番号 | `PORT` | `--port=<number>` | `4873` | ローカルサーバの待受ポート |
| 隔離有効化 | `QUARANTINE_ENABLED` | `--quarantine-enabled=<true|false>` | `true` | 隔離ロジックのオン/オフ |
| 隔離期間（分） | `QUARANTINE_MINUTES` | `--quarantine-minutes=<number>` | `30240` | 公開から何分経過すれば安全とみなすか |
| 安全版なし時ポリシー | `QUARANTINE_POLICY_ON_NO_SAFE` | `--quarantine-policy-on-no-safe=<set-safe|fail>` | `set-safe` | `set-safe`: 安全版があれば `latest` を安全版へ、なければ `latest` を削除。`fail`: 409 を返して失敗 |
| 詳細ログ | `VERBOSE` | `--verbose=<true|false>` | `false` | 詳細ログを有効化（初期レベルは `info` 相当） |
| ログレベル | `LOG_LEVEL` | `--log-level=<info|warn|error|silent>` | `warn`（`VERBOSE=true` 時は `info`） | 出力する最小レベルを制御 |
| ログ形式 | `LOG_FORMAT` | `--log-format=<text|ndjson>` | `text` | `ndjson` で機械可読な 1 行 JSON ログ |
| 上流レジストリ | `UPSTREAM` | `--upstream=<url>` | `https://registry.npmjs.org` | 取得元の Registry ベースURL（プロキシ先） |

例（CLI 引数）:

```zsh
node dist/index.js \
  --port=5000 \
  --quarantine-enabled=true \
  --quarantine-minutes=20160 \
  --quarantine-policy-on-no-safe=set-safe \
  --verbose=true \
  --log-level=info \
  --log-format=ndjson \
  --upstream=https://registry.npmjs.org
```

下限バリデーション: `QUARANTINE_MINUTES` が負値または数値変換できない場合は `0` に補正され、隔離処理は無効扱い（公開直後でも書き換えなし）になります。

例（環境変数）:

```zsh
PORT=5000 QUARANTINE_ENABLED=false QUARANTINE_MINUTES=43200 QUARANTINE_POLICY_ON_NO_SAFE=set-safe \
  VERBOSE=true LOG_LEVEL=info LOG_FORMAT=text UPSTREAM=https://registry.npmjs.org node dist/index.js
```

例（npx 起動）:

パッケージを `npm publish` 済みの場合、以下で直接起動できます。

```zsh
npx npm-hono-proxy \
  --port=4873 \
  --quarantine-enabled=true \
  --quarantine-minutes=30240 \
  --quarantine-policy-on-no-safe=set-safe \
  --log-level=info \
  --log-format=text \
  --upstream=https://registry.npmjs.org
```

例（グローバルインストール）:

グローバルにインストールしてコマンドとして利用できます。

```zsh
npm i -g npm-hono-proxy
npm-hono-proxy \
  --port=4873 \
  --quarantine-enabled=true \
  --quarantine-minutes=30240 \
  --quarantine-policy-on-no-safe=set-safe \
  --log-level=warn \
  --log-format=text \
  --upstream=https://registry.npmjs.org
```

## 挙動概要

- JSON（`application/json`）レスポンスのみを対象にし、`dist-tags.latest` を隔離ポリシーで調整します。
- `.tgz` 等の非 JSON リクエストは 302 で本家（`https://registry.npmjs.org`）へリダイレクトします。
- 安全版が存在しない場合の挙動はポリシーで制御できます（`set-safe`: 安全版がなければ latest を削除、`fail`: 409 で失敗）。

## 監査コマンド (audit)

依存関係を事前に確認し、隔離対象（公開後隔離期間内のバージョン）が原因で `npm install` 時に `ETARGET` になる可能性を示します。

### 使い方

監査のみ（変更なし）:

```zsh
npx npm-hono-proxy audit
```

またはビルド済み直接:

```zsh
node dist/audit.mjs
```

修正付き監査（`package.json` を自動書き換え）:

```zsh
NPM_HONO_PROXY_AUDIT_FIX=true npx npm-hono-proxy audit
```

### 自動修正ポリシー

| ケース | デフォルト挙動 | 例 | 備考 |
|--------|----------------|----|------|
| 範囲指定で解決される最新版が検疫対象 | 最新“安全版”へ厳密固定（prefix除去） | `^4.10.0` → `4.10.4` | lockfile/node_modules に安全版が固定済みなら変更せず維持 |
| 厳密指定が検疫対象 | 最新安全版へ置換 | `4.10.7` → `4.10.4` | 安全版がなければ変更なし |
| 厳密指定が安全 | 変更なし | `4.10.4` | そのまま |
| 範囲指定が安全版を解決 | 変更なし | `^4.10.0` (安全版 4.10.4) | そのまま |
| 安全版なし | 変更なし＋警告 | - | `latestSafeVersion` が求まらない |

### prefix モード

環境変数 `NPM_HONO_PROXY_AUDIT_USE_PREFIX=true` を指定すると、

- 範囲指定を安全版へ縮める際に元の接頭辞（`^` / `~`）を保持、厳密指定化せず `^x.y.z` 形式へ変更。
- 厳密指定検疫 → 安全版へ更新する際に `^` を付与（元が `~` の場合は `~`）。

例:

```zsh
NPM_HONO_PROXY_AUDIT_FIX=true \
NPM_HONO_PROXY_AUDIT_USE_PREFIX=true \
node dist/audit.mjs
```

### 注意点

- `audit fix` は整形を壊さないようにバージョン文字列部分だけ置き換えます。
- lockfile と node_modules に既に安全版が存在する場合は範囲指定を保持し、将来の再インストールでも安全版が確定する前提とします。
- 厳密指定が検疫対象かつ安全版が存在しない場合は手動対応が必要です（警告のみ）。

### CI への組み込み例

```zsh
#!/usr/bin/env bash
set -euo pipefail

echo "Running quarantine audit"
NPM_HONO_PROXY_AUDIT_FIX=true node dist/audit.mjs

git diff --quiet || {
  echo "package.json updated by audit fix; committing"
  git add package.json
  git commit -m "chore: apply audit fix"
}
```

## 開発メモ

- ビルドは tsdown を使用し、出力は ESM（`dist/index.js`）。

## 利用側の設定例（npm クライアント）

プロキシを起動した後、クライアント側でレジストリを切り替える方法です。ローカルで `http://localhost:4873` に立てた場合を例にします。

- `.npmrc` にレジストリを設定（推奨）

```ini
registry=http://localhost:4873/
```

- コマンド単位でレジストリを指定

```zsh
npm install --registry=http://localhost:4873
npx --registry=http://localhost:4873 some-package
```

- パッケージ単位で明示タグ／バージョン指定（隔離と相性が良い）

```zsh
npm install -D vitest@4
npm install hono@4.10.7
```

補足:
- `.npmrc` の `registry` 設定はユーザー単位（グローバル）やプロジェクト単位（ローカルファイル）で切り替え可能です。
- スコープ別にレジストリを分けることも可能です（例: `@company:registry=http://localhost:4873/`）。
