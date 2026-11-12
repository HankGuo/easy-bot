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
   * Enforces row-level security scope (allowed_groups and space_id)
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
    }

    const payload = {
      query,
      top_k: topK,
      space_id: spaceId || undefined,
      allowed_groups: allowedGroups
    };

    const response = await fetch(`${this.endpoint}/api/v1/search/hybrid`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`WeKnora cluster returned HTTP ${response.status}: ${response.statusText}`);
    }

    const data: any = await response.json();
    const items: any[] = Array.isArray(data) ? data : (data.data || data.results || []);

    return items.map((item, index) => {
      const chunk: DocumentChunk = {
        id: item.chunk_id || item.id || `weknora_${index}`,
        documentId: item.document_id || item.doc_id || 'weknora_doc',
        documentTitle: item.document_title || item.title || 'WeKnora Knowledge Asset',
        content: item.content || item.text || '',
        chunkIndex: item.chunk_index ?? index,
        tokens: [],
        spaceId: item.space_id || spaceId,
        ownerGroupId: item.owner_group_id || undefined,
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
   * Ingests a new document into WeKnora knowledge base
   */
  public async ingestDocument(
    documentId: string,
    documentTitle: string,
    content: string,
    spaceId: string = 'public',
    ownerGroupId?: string
  ): Promise<boolean> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.endpoint}/api/v1/documents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        document_id: documentId,
        document_title: documentTitle,
        content,
        space_id: spaceId,
        owner_group_id: ownerGroupId
      }),
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    return response.ok;
  }
}
