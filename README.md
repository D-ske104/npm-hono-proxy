# npm-hono-proxy

NPM Registry のメタデータだけを安全化するローカルプロキシです。`.tgz` 等の実ファイルは本家へリダイレクトし、`dist-tags` を隔離ポリシーに基づいて書き換えます。

## セットアップ

```zsh
npm install
npm run build    # tsdown で ESM を dist に出力（dist/index.mjs）
```

開発起動（ホットなしのシンプル起動）:

```zsh
npm run dev      # tsx で直接 src/index.ts を起動
```

ビルド成果物で起動:

```zsh
node dist/index.mjs
```

## 隔離ポリシーの設定

環境変数または CLI 引数で設定できます。未指定時は「既定値」が適用されます。

| 設定項目 | 環境変数 | CLI 引数 | 既定値 | 挙動 |
|---|---|---|---|---|
| ポート番号 | `PORT` | `--port=<number>` | `4873` | ローカルサーバの待受ポート |
| 隔離有効化 | `QUARANTINE_ENABLED` | `--quarantine-enabled=<true|false>` | `true` | 隔離ロジックのオン/オフ |
| 隔離日数 | `QUARANTINE_DAYS` | `--quarantine-days=<number>` | `21` | `latest` が公開から何日経過すれば安全とみなすか |
| 安全版なし時ポリシー | `QUARANTINE_POLICY_ON_NO_SAFE` | `--quarantine-policy-on-no-safe=<set-safe|fail>` | `set-safe` | `set-safe`: 安全版があれば `latest` を安全版へ、なければ `latest` を削除。`fail`: 409 を返して失敗 |

例（CLI 引数）:

```zsh
node dist/index.mjs \
  --port=5000 \
  --quarantine-enabled=true \
  --quarantine-days=14 \
  --quarantine-policy-on-no-safe=set-safe
```

例（環境変数）:

```zsh
PORT=5000 QUARANTINE_ENABLED=false QUARANTINE_DAYS=30 QUARANTINE_POLICY_ON_NO_SAFE=set-safe \
  node dist/index.mjs
```

## 挙動概要

- JSON（`application/json`）レスポンスのみを対象にし、`dist-tags.latest` を隔離ポリシーで調整します。
- `.tgz` 等の非 JSON リクエストは 302 で本家（`https://registry.npmjs.org`）へリダイレクトします。
- 安全版が存在しない場合の挙動はポリシーで制御できます（`set-safe`: 安全版がなければ latest を削除、`fail`: 409 で失敗）。

## 開発メモ

- ビルドは tsdown を使用し、出力は ESM（`dist/index.mjs`）。
