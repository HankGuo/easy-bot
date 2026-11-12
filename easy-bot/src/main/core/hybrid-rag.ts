import { PDFParse } from 'pdf-parse';
import { WeKnoraDriver } from './weknora-driver.js';

export interface DocumentChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  content: string;
  chunkIndex: number;
  tokens: string[];
  embedding?: number[];
  spaceId?: string; // e.g. 'public', 'college_cs', 'lab_ai'
  ownerGroupId?: string; // Group ID permitted to read, or undefined for public
  metadata?: Record<string, any>;
}

export interface RetrievalResult {
  chunk: DocumentChunk;
  score: number;
  bm25Rank: number;
  vectorRank?: number;
  matchedKeywords: string[];
}

export interface EmbeddingConfig {
  endpoint?: string;
  apiKey?: string;
  model?: string;
}

/**
 * Industrial Knowledge Retrieval Engine (Okapi BM25 + Pluggable Vectors + Multi-Space Governance)
 * 
 * DESIGN RATIONALE:
 * Provides multi-space knowledge partitioning (public, college, confidential lab).
 * Enforces row-level permission filtering against user group IDs.
 * Implements deterministic Okapi BM25 + optional Dense Vector Embeddings + RRF re-ranking.
 */
export class HybridRAGEngine {
  private chunks: Map<string, DocumentChunk> = new Map();
  private invertedIndex: Map<string, Set<string>> = new Map(); // token -> Set<chunkId>
  private docLengths: Map<string, number> = new Map();
  private avgDocLength: number = 0;
  private embeddingConfig?: EmbeddingConfig;
  private weknoraDriver?: WeKnoraDriver;

  // BM25 parameters
  private readonly k1 = 1.5;
  private readonly b = 0.75;
  private readonly rrfK = 60; // Reciprocal Rank Fusion constant

  constructor(embeddingConfig?: EmbeddingConfig, weknoraDriver?: WeKnoraDriver) {
    this.embeddingConfig = embeddingConfig;
    if (weknoraDriver) {
      this.weknoraDriver = weknoraDriver;
    } else if (process.env.WEKNORA_URL) {
      this.weknoraDriver = new WeKnoraDriver();
    }
  }

  public setWeKnoraDriver(driver: WeKnoraDriver) {
    this.weknoraDriver = driver;
  }

  public getWeKnoraDriver(): WeKnoraDriver | undefined {
    return this.weknoraDriver;
  }

  public setEmbeddingConfig(config: EmbeddingConfig) {
    this.embeddingConfig = config;
  }

  /**
   * Generates real dense vector embedding for text via configured OpenAI/SenseNova/BGE endpoint
   */
  public async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.embeddingConfig || !this.embeddingConfig.model) {
      return null;
    }
    const cleanBase = (this.embeddingConfig.endpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const url = `${cleanBase}/embeddings`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.embeddingConfig.apiKey ? { 'Authorization': `Bearer ${this.embeddingConfig.apiKey}` } : {})
        },
        body: JSON.stringify({
          model: this.embeddingConfig.model,
          input: [text.slice(0, 2048)]
        }),
        signal: AbortSignal.timeout(10000)
      });
      if (!res.ok) return null;
      const json: any = await res.json();
      return json.data?.[0]?.embedding || null;
    } catch {
      return null;
    }
  }

  /**
   * Tokenize text into normalized tokens with CJK bigrams and industrial code preservation
   */
  public tokenize(text: string): string[] {
    const clean = text.toLowerCase();
    const tokens: string[] = [];

    // 1. Match industrial alphanumeric tokens (e.g. E-06, SOP-EQ-01, h6, H7, PA66, 0.012mm)
    const industrialTokens = clean.match(/[a-z0-9]+(?:[-_/][a-z0-9]+)*/g) || [];
    tokens.push(...industrialTokens);

    // 2. CJK single characters and bigrams
    const cjkMatches = clean.match(/[\u4e00-\u9fa5]/g) || [];
    tokens.push(...cjkMatches);

    for (let i = 0; i < cjkMatches.length - 1; i++) {
      tokens.push(cjkMatches[i] + cjkMatches[i + 1]);
    }

    return tokens;
  }

  /**
   * Add a document with automated parent-child sliding window chunking and space governance
   */
  public addDocument(
    documentId: string,
    documentTitle: string,
    content: string,
    chunkSize: number = 300,
    chunkOverlap: number = 50,
    embeddings?: number[][],
    spaceId: string = 'public',
    ownerGroupId?: string
  ): DocumentChunk[] {
    const addedChunks: DocumentChunk[] = [];
    let start = 0;
    let index = 0;

    while (start < content.length) {
      const end = Math.min(content.length, start + chunkSize);
      const chunkText = content.substring(start, end).trim();

      if (chunkText.length > 0) {
        const chunkId = `${documentId}#chunk-${index}`;
        const tokens = this.tokenize(chunkText);
        const chunkEmbedding = embeddings ? embeddings[index] : undefined;

        const chunk: DocumentChunk = {
          id: chunkId,
          documentId,
          documentTitle,
          content: chunkText,
          chunkIndex: index,
          tokens,
          embedding: chunkEmbedding,
          spaceId,
          ownerGroupId
        };

        this.chunks.set(chunkId, chunk);
        this.docLengths.set(chunkId, tokens.length);

        // Update Inverted Index
        for (const token of new Set(tokens)) {
          if (!this.invertedIndex.has(token)) {
            this.invertedIndex.set(token, new Set());
          }
          this.invertedIndex.get(token)!.add(chunkId);
        }

        addedChunks.push(chunk);
        index++;
      }

      start += chunkSize - chunkOverlap;
    }

    // Update average doc length
    let totalLen = 0;
    for (const len of this.docLengths.values()) {
      totalLen += len;
    }
    this.avgDocLength = this.chunks.size > 0 ? totalLen / this.chunks.size : 0;

    // Background embedding generation if dense embedding endpoint is configured
    if (this.embeddingConfig && this.embeddingConfig.model && !embeddings) {
      Promise.resolve().then(async () => {
        for (const chunk of addedChunks) {
          try {
            const emb = await this.generateEmbedding(chunk.content);
            if (emb && this.chunks.has(chunk.id)) {
              this.chunks.get(chunk.id)!.embedding = emb;
            }
          } catch {}
        }
      });
    }

    return addedChunks;
  }

  public async addDocumentWithEmbedding(
    documentId: string,
    documentTitle: string,
    content: string,
    chunkSize: number = 300,
    chunkOverlap: number = 50,
    spaceId: string = 'public',
    ownerGroupId?: string
  ): Promise<DocumentChunk[]> {
    const chunks = this.addDocument(documentId, documentTitle, content, chunkSize, chunkOverlap, undefined, spaceId, ownerGroupId);
    if (this.embeddingConfig && this.embeddingConfig.model) {
      for (const chunk of chunks) {
        try {
          const emb = await this.generateEmbedding(chunk.content);
          if (emb) {
            chunk.embedding = emb;
          }
        } catch {}
      }
    }
    return chunks;
  }

  public async queryHybridAsync(
    queryText: string,
    allowedGroupIds: string[] = [],
    topK: number = 5,
    targetSpaceId?: string
  ): Promise<RetrievalResult[]> {
    // 1. Try Tencent WeKnora driver if configured
    if (this.weknoraDriver) {
      try {
        const weknoraHits = await this.weknoraDriver.searchHybrid(queryText, allowedGroupIds, topK, targetSpaceId);
        if (weknoraHits && weknoraHits.length > 0) {
          return weknoraHits;
        }
      } catch (err: any) {
        console.warn('[HybridRAG] Tencent WeKnora cluster fallback to embedded engine:', err.message);
      }
    }

    // 2. Embedded Hybrid Engine Fallback
    let queryEmbedding: number[] | undefined;
    if (this.embeddingConfig && this.embeddingConfig.model) {
      const emb = await this.generateEmbedding(queryText);
      if (emb) queryEmbedding = emb;
    }
    return this.queryWithScope(queryText, allowedGroupIds, topK, targetSpaceId, queryEmbedding);
  }

  /**
   * Add a PDF document buffer (extracts text and indexes it)
   */
  public async addPdfDocument(
    documentId: string,
    documentTitle: string,
    pdfBuffer: Buffer,
    chunkSize: number = 300,
    chunkOverlap: number = 50,
    spaceId: string = 'public',
    ownerGroupId?: string
  ): Promise<DocumentChunk[]> {
    try {
      const parser = new (PDFParse as any)({ data: pdfBuffer });
      await parser.load();
      const textResult = await parser.getText();
      const content = typeof textResult === 'string' ? textResult : (textResult as any)?.text || '';
      return this.addDocument(documentId, documentTitle, content, chunkSize, chunkOverlap, undefined, spaceId, ownerGroupId);
    } catch (err: any) {
      return this.addDocument(documentId, documentTitle, `[PDF: ${documentTitle}]`, chunkSize, chunkOverlap, undefined, spaceId, ownerGroupId);
    }
  }

  /**
   * Add a Microsoft Word (.docx) document buffer (extracts text via mammoth and indexes it)
   */
  public async addWordDocument(
    documentId: string,
    documentTitle: string,
    docxBuffer: Buffer,
    chunkSize: number = 300,
    chunkOverlap: number = 50,
    spaceId: string = 'public',
    ownerGroupId?: string
  ): Promise<DocumentChunk[]> {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: docxBuffer });
      const content = result.value || '';
      return this.addDocument(documentId, documentTitle, content, chunkSize, chunkOverlap, undefined, spaceId, ownerGroupId);
    } catch (err: any) {
      console.warn(`[HybridRAG] Failed to parse Word document ${documentTitle}:`, err.message);
      return this.addDocument(documentId, documentTitle, `[DOCX: ${documentTitle}]`, chunkSize, chunkOverlap, undefined, spaceId, ownerGroupId);
    }
  }

  /**
   * Add a Microsoft Excel (.xlsx/.csv) spreadsheet document buffer (extracts sheets to tabular text and indexes it)
   */
  public async addExcelDocument(
    documentId: string,
    documentTitle: string,
    excelBuffer: Buffer,
    chunkSize: number = 300,
    chunkOverlap: number = 50,
    spaceId: string = 'public',
    ownerGroupId?: string
  ): Promise<DocumentChunk[]> {
    try {
      const xlsx = await import('xlsx');
      const workbook = xlsx.read(excelBuffer, { type: 'buffer' });
      const sheetsContent: string[] = [];

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const csv = xlsx.utils.sheet_to_csv(worksheet);
        if (csv.trim()) {
          sheetsContent.push(`【工作表: ${sheetName}】\n${csv.trim()}`);
        }
      }

      const content = sheetsContent.join('\n\n');
      return this.addDocument(documentId, documentTitle, content, chunkSize, chunkOverlap, undefined, spaceId, ownerGroupId);
    } catch (err: any) {
      console.warn(`[HybridRAG] Failed to parse Excel document ${documentTitle}:`, err.message);
      return this.addDocument(documentId, documentTitle, `[XLSX: ${documentTitle}]`, chunkSize, chunkOverlap, undefined, spaceId, ownerGroupId);
    }
  }

  /**
   * Standard Okapi BM25 Scoring calculation for a query on accessible chunks
   */
  private scoreBM25(queryTokens: string[], candidateChunkIds: Set<string>): Map<string, { score: number; matches: string[] }> {
    const scores = new Map<string, { score: number; matches: string[] }>();
    const N = candidateChunkIds.size > 0 ? candidateChunkIds.size : this.chunks.size;

    for (const token of queryTokens) {
      const postingList = this.invertedIndex.get(token);
      if (!postingList || postingList.size === 0) continue;

      // Intersect posting list with accessible chunks
      const matchedAccessible: string[] = [];
      for (const id of postingList) {
        if (candidateChunkIds.has(id)) {
          matchedAccessible.push(id);
        }
      }
      if (matchedAccessible.length === 0) continue;

      const n = matchedAccessible.length;
      // Standard Okapi BM25 IDF formula
      const idf = Math.log((N - n + 0.5) / (n + 0.5) + 1);

      for (const chunkId of matchedAccessible) {
        const chunk = this.chunks.get(chunkId)!;
        const tf = chunk.tokens.filter(t => t === token).length;
        const docLen = this.docLengths.get(chunkId) || 1;
        
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / (this.avgDocLength || 1)));
        const tokenScore = idf * (numerator / denominator);

        const existing = scores.get(chunkId) || { score: 0, matches: [] };
        existing.score += tokenScore;
        existing.matches.push(token);
        scores.set(chunkId, existing);
      }
    }

    return scores;
  }

  /**
   * Cosine similarity between two float vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Query the index with organizational permissions scoping.
   * Public chunks are visible to all; lab/confidential chunks only visible if user belongs to ownerGroupId.
   */
  public queryWithScope(
    queryText: string,
    allowedGroupIds: string[] = [],
    topK: number = 5,
    targetSpaceId?: string,
    queryEmbedding?: number[]
  ): RetrievalResult[] {
    const candidateChunkIds = new Set<string>();

    for (const [chunkId, chunk] of this.chunks.entries()) {
      if (targetSpaceId && chunk.spaceId && chunk.spaceId !== targetSpaceId) {
        continue;
      }
      // Access Rule: public space OR user belongs to ownerGroupId OR user is superadmin (passed via group)
      const isPublic = !chunk.ownerGroupId || chunk.spaceId === 'public';
      const isGranted = chunk.ownerGroupId ? allowedGroupIds.includes(chunk.ownerGroupId) : false;

      if (isPublic || isGranted) {
        candidateChunkIds.add(chunkId);
      }
    }

    if (candidateChunkIds.size === 0) {
      return [];
    }

    const queryTokens = this.tokenize(queryText);
    const bm25Map = this.scoreBM25(queryTokens, candidateChunkIds);

    // 1. BM25 Sorted Ranking
    const bm25Sorted = Array.from(bm25Map.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .map(([chunkId, data], idx) => ({ chunkId, rank: idx + 1, score: data.score, matches: data.matches }));

    // 2. Vector Ranking (only if query embedding and chunk embeddings are present)
    const hasVectorSupport = Boolean(
      queryEmbedding && Array.from(candidateChunkIds).some(id => Boolean(this.chunks.get(id)?.embedding))
    );

    if (!hasVectorSupport) {
      // Pure BM25 mode with permission filtering
      return bm25Sorted.slice(0, topK).map(item => ({
        chunk: this.chunks.get(item.chunkId)!,
        score: item.score,
        bm25Rank: item.rank,
        matchedKeywords: item.matches
      }));
    }

    // 3. Vector Ranking + RRF (Reciprocal Rank Fusion)
    const vectorScores: { chunkId: string; score: number }[] = [];
    for (const chunkId of candidateChunkIds) {
      const chunk = this.chunks.get(chunkId);
      if (chunk?.embedding && queryEmbedding) {
        const sim = this.cosineSimilarity(queryEmbedding, chunk.embedding);
        vectorScores.push({ chunkId, score: sim });
      }
    }
    const vectorSorted = vectorScores
      .sort((a, b) => b.score - a.score)
      .map((item, idx) => ({ chunkId: item.chunkId, rank: idx + 1, score: item.score }));

    const rrfScores = new Map<string, { rrf: number; bm25Rank: number; vectorRank: number; matches: string[] }>();

    for (const item of bm25Sorted) {
      const entry = rrfScores.get(item.chunkId) || { rrf: 0, bm25Rank: 9999, vectorRank: 9999, matches: [] };
      entry.bm25Rank = item.rank;
      entry.rrf += 1 / (this.rrfK + item.rank);
      entry.matches = item.matches;
      rrfScores.set(item.chunkId, entry);
    }

    for (const item of vectorSorted) {
      const entry = rrfScores.get(item.chunkId) || { rrf: 0, bm25Rank: 9999, vectorRank: 9999, matches: [] };
      entry.vectorRank = item.rank;
      entry.rrf += 1 / (this.rrfK + item.rank);
      rrfScores.set(item.chunkId, entry);
    }

    return Array.from(rrfScores.entries())
      .sort((a, b) => b[1].rrf - a[1].rrf)
      .slice(0, topK)
      .map(([chunkId, meta]) => ({
        chunk: this.chunks.get(chunkId)!,
        score: meta.rrf,
        bm25Rank: meta.bm25Rank,
        vectorRank: meta.vectorRank,
        matchedKeywords: meta.matches
      }));
  }

  /**
   * Backward-compatible query
   */
  public query(queryText: string, topK: number = 5, queryEmbedding?: number[]): RetrievalResult[] {
    return this.queryWithScope(queryText, [], topK, undefined, queryEmbedding);
  }

  public listDocuments(): { id: string; title: string; spaceId?: string; ownerGroupId?: string; chunksCount: number; totalTokens: number }[] {
    const docMap = new Map<string, { id: string; title: string; spaceId?: string; ownerGroupId?: string; chunksCount: number; totalTokens: number }>();
    for (const chunk of this.chunks.values()) {
      const existing = docMap.get(chunk.documentId) || {
        id: chunk.documentId,
        title: chunk.documentTitle,
        spaceId: chunk.spaceId,
        ownerGroupId: chunk.ownerGroupId,
        chunksCount: 0,
        totalTokens: 0
      };
      existing.chunksCount += 1;
      existing.totalTokens += chunk.tokens.length;
      docMap.set(chunk.documentId, existing);
    }
    return Array.from(docMap.values());
  }

  public removeDocument(documentId: string): boolean {
    const chunksToRemove: string[] = [];
    for (const [chunkId, chunk] of this.chunks.entries()) {
      if (chunk.documentId === documentId) {
        chunksToRemove.push(chunkId);
      }
    }

    if (chunksToRemove.length === 0) return false;

    for (const chunkId of chunksToRemove) {
      this.chunks.delete(chunkId);
      this.docLengths.delete(chunkId);

      for (const postingSet of this.invertedIndex.values()) {
        postingSet.delete(chunkId);
      }
    }

    let totalLen = 0;
    for (const len of this.docLengths.values()) {
      totalLen += len;
    }
    this.avgDocLength = this.chunks.size > 0 ? totalLen / this.chunks.size : 0;

    return true;
  }

  public clearDocuments(): void {
    this.chunks.clear();
    this.invertedIndex.clear();
    this.docLengths.clear();
    this.avgDocLength = 0;
  }

  public getStats() {
    const hasEmbeddings = Array.from(this.chunks.values()).some(c => Boolean(c.embedding));
    return {
      totalChunks: this.chunks.size,
      vocabularySize: this.invertedIndex.size,
      avgDocLength: Math.round(this.avgDocLength),
      retrievalMode: hasEmbeddings ? 'Hybrid (Okapi BM25 + Dense Vectors)' : 'Pure Okapi BM25 (Deterministic Lexical)',
      vectorStatus: hasEmbeddings ? 'Active' : 'Not Configured (Operating in High-Precision BM25 Mode)',
      weknoraDriver: this.weknoraDriver ? 'Active (Tencent WeKnora Enterprise Driver)' : 'Standby (Embedded High-Precision Mode)'
    };
  }
}
