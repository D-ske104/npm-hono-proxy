# Playground

このディレクトリは `npm-hono-proxy` のデバッグ用です。

## 使い方

1. 下記の **VS Code タスク** または **npm scripts** を使ってプロキシサーバーを起動します。
2. 別のターミナルを開き、`playground/test-project` ディレクトリに移動します。
3. `npm install` を実行して挙動を確認します。

## サーバーの起動

VS Code の「タスクの実行 (Run Task)」コマンド、またはプロジェクトルートで npm コマンドを直接実行して起動できます。

| VS Code タスク | npm スクリプト | 説明 |
| :--- | :--- | :--- |
| **Playground: Dev Server** | `npm run play:dev` | 開発モードでサーバーを起動します (`npm run dev`)。 |
| **Playground: Bin (Build & Run)** | `npm run play:bin` | ビルドを行い、CLIスクリプト経由でサーバーを起動します (`node bin/cli.js`)。 |
| **Playground: NPX (Build & Run)** | `npm run play:npx` | ビルドを行い、`npx .` を使用してインストール済みパッケージとしての挙動をシミュレートして起動します。 |

## ヘルパースクリプト

プロキシの挙動検証を支援するスクリプトです。

| npm スクリプト | 説明 |
| :--- | :--- |
| `npm run play:reset` | `test-project` 内の `node_modules` と `package-lock.json` を削除してリセットします。 |
| `npm run play:verify` | `test-project` に `hono` が正常にインストールされたかを確認します。（チェック対象は `playground/scripts/verify.js` で変更可能） |

## テストプロジェクト

`test-project` ディレクトリには、ローカルプロキシ (`http://localhost:4873`) を使用するように設定された `.npmrc` と `package.json` が含まれています。
