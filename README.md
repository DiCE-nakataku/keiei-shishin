# 経営指針書作成ツール

ブラウザーでExcelを読み込み、経営指針書のページ表示・発表・印刷を行う静的Webアプリです。アップロードしたExcelと画像はブラウザー内で処理します。PDF保存はブラウザー標準の印刷機能を使うため、PDF変換用のCanvas/PDFライブラリは同梱していません。

## 起動

`index.html` をブラウザーで開きます。`styles.css`、`vendor/`、`dist/`、`motion/`、`downloads/` は同じフォルダー構成で保持してください。オンライン時はGoogle Fontsを読み込みます。

## 安全確認

Node.js 20以降で、リポジトリのルートから実行します。開発チェックを使う場合は `npm ci` で開発依存をインストールします。実行時のWebアプリにはnpmパッケージを追加していません。

```powershell
npm test
npm run check:syntax
npm run format:check
npm run lint
npm run typecheck
npm run check
```

Prettier、ESLint、TypeScriptは開発依存です。`npm test` はサンプルExcelの数式、印刷ゲート、ダウンロード、テーマ切替、FAQ開閉、ドロップゾーン、Excel読込とエラー処理、各ページ生成の表示ルールを確認します。`check:syntax` はHTML内のJavaScript、`src/`、`motion/` の構文を検査します。画面操作、印刷、アップロード、セル整形、表・カード組み立て、ページ枠、各シートの描画処理は責務ごとに `src/` 以下へ段階的に分離しています。 表紙と10年ビジョンの描画・画像レイアウトも `src/page-branding.js` に分離しています。 シート名から各ページ描画関数への振り分けと追加表分割は `src/workbook-pages.js` が担います。 Excel計算、出力対象の選択、ページ生成の進行制御は `src/workbook-controller.js` にあります。 アップロード・計算・印刷間で共有するWorkbook状態は `src/workbook-state.js` に集約しています。Prettierは設定・テスト・ドキュメントだけを対象にし、既存アプリ全体の一括整形はしません。ESLintは分離済みの `motion/`、`src/` とNodeスクリプト・テストを対象にします。

TypeScriptの設定は、既存JavaScriptの型チェックをまだ有効化していません。既存 `motion/` は共有グローバルやDOM型の不足を含み、型チェックには段階的な型定義・分割が必要です。メインの `index.html` 内のインラインJavaScriptも対象外です。ブラウザーE2Eは引き続き未設定です。
