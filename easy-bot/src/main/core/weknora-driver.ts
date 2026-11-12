import { DocumentChunk, RetrievalResult } from './hybrid-rag.js';

export interface WeKnoraConfig {
  endpoint?: string;
  apiKey?: string;
  defaultKnowledgeBaseId?: string;
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
  private defaultKnowledgeBaseId: string;
  private timeoutMs: number;

  constructor(config?: WeKnoraConfig) {
    this.endpoint = (config?.endpoint || process.env.WEKNORA_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
    this.apiKey = config?.apiKey || process.env.WEKNORA_API_KEY;
    this.defaultKnowledgeBaseId = config?.defaultKnowledgeBaseId || process.env.WEKNORA_DEFAULT_KB_ID || 'default';
    this.timeoutMs = config?.timeoutMs || 8000;
  }

  public getEndpoint(): string {
    return this.endpoint;
  }

  /**
   * Health check probe against WeKnora backend: GET /api/v1/health
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
   * Uses official WeKnora API specifications:
   * - Space-scoped: POST /api/v1/knowledge-bases/{spaceId}/hybrid-search
   * - Global: POST /api/v1/knowledge-search
   *
   * Note on Access Control: Upstream WeKnora search does not accept raw metadata_filter;
   * row-level security isolation (allowedGroups) is strictly enforced post-retrieval.
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

    const kbId = spaceId || this.defaultKnowledgeBaseId;
    const isScoped = Boolean(spaceId);

    const endpointUrl = isScoped
      ? `${this.endpoint}/api/v1/knowledge-bases/${encodeURIComponent(kbId)}/hybrid-search`
      : `${this.endpoint}/api/v1/knowledge-search`;

    // Official WeKnora Request Payload
    const payload = isScoped
      ? {
          query,
          top_k: topK,
          match_count: topK,
          rerank: { enabled: true }
        }
      : {
          query,
          knowledge_base_id: kbId,
          knowledge_base_ids: [kbId],
          top_k: topK,
          match_count: topK,
          rerank: { enabled: true }
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

    const mapped: RetrievalResult[] = items.map((item, index) => {
      const ownerGroupId = item.owner_group_id ||
        item.metadata?.owner_group_id ||
        item.custom_metadata?.owner_group_id ||
        undefined;

      const chunk: DocumentChunk = {
        id: item.chunk_id || item.id || `weknora_${index}`,
        documentId: item.document_id || item.doc_id || item.documentId || 'weknora_doc',
        documentTitle: item.document_title || item.title || item.documentTitle || 'WeKnora Knowledge Asset',
        content: item.content || item.text || item.chunk_text || '',
        chunkIndex: item.chunk_index ?? index,
        tokens: [],
        spaceId: item.space_id || item.knowledge_base_id || kbId,
        ownerGroupId,
        metadata: item.metadata || item.custom_metadata || {}
      };

      return {
        chunk,
        score: typeof item.score === 'number' ? item.score : 1 / (1 + index),
        bm25Rank: item.bm25_rank ?? index + 1,
        vectorRank: item.vector_rank,
        matchedKeywords: item.matched_keywords || []
      };
    });

    // Row-level Security Enforcement: Filter out documents restricted to other groups
    if (allowedGroups.length > 0) {
      return mapped.filter(r => {
        if (!r.chunk.ownerGroupId) return true; // public
        return allowedGroups.includes(r.chunk.ownerGroupId);
      });
    }

    return mapped;
  }

  /**
   * Ingests a new document into official WeKnora knowledge base:
   * Uses upstream official manual markdown knowledge creation endpoint:
   * POST /api/v1/knowledge-bases/{spaceId}/knowledge/manual
   * Note: status is set to 'publish' to immediately index the document (avoiding draft state).
   */
  public async ingestDocument(
    documentId: string,
    documentTitle: string,
    content: string,
    spaceId?: string,
    ownerGroupId?: string
  ): Promise<boolean> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
      headers['X-API-Key'] = this.apiKey;
    }

    const targetSpace = spaceId || this.defaultKnowledgeBaseId;
    const url = `${this.endpoint}/api/v1/knowledge-bases/${encodeURIComponent(targetSpace)}/knowledge/manual`;

    const payload = {
      title: documentTitle,
      content,
      status: 'publish', // Required to index immediately; omitting defaults to unsearchable draft
      custom_metadata: {
        document_id: documentId,
        owner_group_id: ownerGroupId,
        ingested_at: new Date().toISOString()
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    return response.ok;
  }

  /**
   * Update existing manual knowledge item in WeKnora:
   * PUT /api/v1/knowledge/manual/{knowledgeId}
   */
  public async updateKnowledge(
    knowledgeId: string,
    content: string,
    status: 'publish' | 'draft' = 'publish'
  ): Promise<boolean> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
      headers['X-API-Key'] = this.apiKey;
    }

    const response = await fetch(`${this.endpoint}/api/v1/knowledge/manual/${encodeURIComponent(knowledgeId)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ content, status }),
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    return response.ok;
  }
}
