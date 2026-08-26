export type LiveReaderId = 'miniflux' | 'freshrss'

export type StubReaderId = 'inoreader' | 'feedbin' | 'newsblur'

export type ReaderId = LiveReaderId | StubReaderId

export interface MinifluxConnection {
  baseUrl: string
  token: string
}

export interface FreshRssConnection {
  baseUrl: string
  username: string
  apiPassword: string
}

export interface ConnectionsState {
  miniflux?: MinifluxConnection
  freshrss?: FreshRssConnection
}

export interface ReaderFeedSummary {
  id: string
  title: string
  xmlUrl: string
  categoryId?: string
  categoryTitle?: string
  /** Reader-reported last fetch/parse error, if any. */
  lastError?: string
}

export interface ReaderCategorySummary {
  id: string
  title: string
  feedCount: number
}

export interface ReaderStatusSummary {
  feedCount: number
  categoryCount?: number
  /** Short lines for feeds that report an error. */
  lastErrors: { title: string; detail: string }[]
}

export interface ReaderAdapter {
  readonly id: LiveReaderId
  test(): Promise<void>
  exportOpml(): Promise<string>
  importOpml(opml: string): Promise<void>
  listFeeds(): Promise<ReaderFeedSummary[]>
  deleteFeed(id: string): Promise<void>
  listCategories(): Promise<ReaderCategorySummary[]>
  deleteCategory(id: string): Promise<void>
  summarize(): Promise<ReaderStatusSummary>
}
