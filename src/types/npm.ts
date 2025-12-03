export type NpmTimeMap = Record<string, string> & { created?: string; modified?: string }
export type DistTags = Record<string, string>
export interface NpmMeta {
  'dist-tags'?: DistTags
  time?: NpmTimeMap
  versions?: Record<string, unknown>
  [k: string]: unknown
}
