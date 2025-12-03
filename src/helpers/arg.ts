// 簡易的な環境変数 / コマンドライン引数の取得
export function getArg(key: string): string | undefined {
  const arg = process.argv.find(a => a.startsWith(`--${key}=`))
  return arg ? arg.split('=')[1] : process.env[key.toUpperCase().replace(/-/g, '_')]
}
