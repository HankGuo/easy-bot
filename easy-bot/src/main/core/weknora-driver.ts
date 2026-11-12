import { DocumentChunk, RetrievalResult } from './hybrid-rag.js';

export interface WeKnoraConfig {
  endpoint?: string;
  apiKey?: string;
  timeoutMs?: number;
}

/**
 * Enterprise Tencent WeKnora RAG Driver
 * Seamlessly integrates Tencent WeKnora (Go + ParadeDB BM25 + pgvector + Neo4j GraphRAG + Docreader OCR)
 * Official Repo: github.com/Tencent/WeKnora
 */
export class WeKnoraDriver {
  private endpoint: string;
  private apiKey?: string;
  private timeoutMs: number;

  constructor(config?: WeKnoraConfig) {
    this.endpoint = (config?.endpoint || process.env.WEKNORA_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
    this.apiKey = config?.apiKey || process.env.WEKNORA_API_KEY;
    this.timeoutMs = config?.timeoutMs || 8000;
  }

  public getEndpoint(): string {
    return this.endpoint;
  }

  /**
   * Health check probe against WeKnora backend
   */
  public async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.endpoint}/api/v1/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Dispatches hybrid search (BM25 + Dense Vectors + GraphRAG) to WeKnora cluster
   * Uses official WeKnora endpoints:
   * - Space-scoped: POST /api/v1/knowledge-bases/{spaceId}/hybrid-search
   * - Global: POST /api/v1/knowledge-search
   */
  public async searchHybrid(
    query: string,
    allowedGroups: string[] = [],
    topK: number = 5,
    spaceId?: string
  ): Promise<RetrievalResult[]> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
      headers['X-API-Key'] = this.apiKey;
    }

    const endpointUrl = spaceId
      ? `${this.endpoint}/api/v1/knowledge-bases/${encodeURIComponent(spaceId)}/hybrid-search`
      : `${this.endpoint}/api/v1/knowledge-search`;

    const payload = {
      query_text: query,
      knowledge_base_ids: spaceId ? [spaceId] : undefined,
      match_count: topK,
      vector_threshold: 0.4,
      keyword_threshold: 0.2,
      rerank: {
        enabled: true
      },
      metadata_filter: allowedGroups.length > 0 ? {
        owner_group_id: { $in: allowedGroups }
      } : undefined
    };

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`WeKnora cluster returned HTTP ${response.status}: ${response.statusText}`);
    }

    const data: any = await response.json();
    const items: any[] = Array.isArray(data)
      ? data
      : (data.data || data.results || data.documents || data.chunks || []);

    return items.map((item, index) => {
      const chunk: DocumentChunk = {
        id: item.chunk_id || item.id || `weknora_${index}`,
        documentId: item.document_id || item.doc_id || item.documentId || 'weknora_doc',
        documentTitle: item.document_title || item.title || item.documentTitle || 'WeKnora Knowledge Asset',
        content: item.content || item.text || item.chunk_text || '',
        chunkIndex: item.chunk_index ?? index,
        tokens: [],
        spaceId: item.space_id || item.knowledge_base_id || spaceId,
        ownerGroupId: item.owner_group_id || item.metadata?.owner_group_id || undefined,
        metadata: item.metadata || {}
      };

      return {
        chunk,
        score: typeof item.score === 'number' ? item.score : 1 / (1 + index),
        bm25Rank: item.bm25_rank ?? index + 1,
        vectorRank: item.vector_rank,
        matchedKeywords: item.matched_keywords || []
      };
    });
  }

  /**
   * Ingests a new document into official WeKnora knowledge base:
   * POST /api/v1/knowledge-bases/{spaceId}/documents
   */
  public async ingestDocument(
    documentId: string,
    documentTitle: string,
    content: string,
    spaceId: string = 'default',
    ownerGroupId?: string
  ): Promise<boolean> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
      headers['X-API-Key'] = this.apiKey;
    }

    const targetSpace = spaceId || 'default';
    const response = await fetch(`${this.endpoint}/api/v1/knowledge-bases/${encodeURIComponent(targetSpace)}/documents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: documentTitle,
        content,
        metadata: {
          document_id: documentId,
          owner_group_id: ownerGroupId,
          ingested_at: new Date().toISOString()
        }
      }),
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    return response.ok;
  }
}
