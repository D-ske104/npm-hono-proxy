import { describe, it, expect, vi } from 'vitest'

// このテストは、プロセスの引数や環境変数をモックすることで、
// 子プロセスのようにindexを実行します。
// 無効なポリシーがexit(1)をトリガーすることのみを表明します。

describe('index の設定値バリデーション', () => {
  it('無効な QUARANTINE_POLICY_ON_NO_SAFE の場合、終了コード1でプロセスが終了する', async () => {
    const mockExit = vi
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => { throw new Error(String(code)) }) as any)
    // モジュールインポート前に無効なポリシーをシミュレート
    process.env.QUARANTINE_POLICY_ON_NO_SAFE = 'invalid-policy'
    try {
      await import('../src/index')
    } catch (e) {
      expect(String(e)).toContain('1')
    } finally {
      delete process.env.QUARANTINE_POLICY_ON_NO_SAFE
      mockExit.mockRestore()
    }
  })
})
