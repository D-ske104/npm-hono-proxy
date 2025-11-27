export type NpmTimeMap = Record<string, string> & { created?: string; modified?: string }
export type DistTags = Record<string, string>
export interface NpmPackageMeta {
  'dist-tags'?: DistTags
  time?: NpmTimeMap
  [k: string]: unknown
}
