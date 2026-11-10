import * as crypto from 'node:crypto';

export interface DocumentChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  content: string;
  chunkIndex: number;
  tokens: string[];
  embedding?: number[];
  metadata?: Record<string, any>;
}

export interface RetrievalResult {
  chunk: DocumentChunk;
  score: number;
  bm25Rank: number;
  vectorRank: number;
  matchedKeywords: string[];
}

/**
 * Enterprise-Grade Hybrid RAG Engine
 * Inspired by Tencent WeKnora's dual BM25 + Vector pipeline with Reciprocal Rank Fusion (RRF)
 */
export class HybridRAGEngine {
  private chunks: Map<string, DocumentChunk> = new Map();
  private invertedIndex: Map<string, Set<string>> = new Map(); // token -> chunkIds
  private docLengths: Map<string, number> = new Map();
  private avgDocLength: number = 0;

  // BM25 parameters
  private readonly k1 = 1.5;
  private readonly b = 0.75;
  private readonly rrfK = 60; // Reciprocal Rank Fusion constant

  constructor() {}

  /**
   * Tokenize text into normalized n-grams/words (supporting CJK & English)
   */
  public tokenize(text: string): string[] {
    const clean = text.toLowerCase();
    // Match english words and CJK single characters / bigrams
    const words: string[] = [];
    const englishTokens = clean.match(/[a-z0-9_]+/g) || [];
    words.push(...englishTokens);

    // CJK character extractor
    const cjkMatches = clean.match(/[\u4e00-\u9fa5]/g) || [];
    words.push(...cjkMatches);

    // CJK bigrams
    for (let i = 0; i < cjkMatches.length - 1; i++) {
      words.push(cjkMatches[i] + cjkMatches[i + 1]);
    }

    return words;
  }

  /**
   * Add a document with automated parent-child chunking
   */
  public addDocument(
    documentId: string,
    documentTitle: string,
    content: string,
    chunkSize: number = 300,
    chunkOverlap: number = 50
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
        
        // Mock lightweight deterministic vector embedding for local scoring demonstration
        const embedding = this.computeLightweightEmbedding(tokens);

        const chunk: DocumentChunk = {
          id: chunkId,
          documentId,
          documentTitle,
          content: chunkText,
          chunkIndex: index,
          tokens,
          embedding
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

    return addedChunks;
  }

  /**
   * BM25 Scoring calculation for a query against all indexed chunks
   */
  private scoreBM25(queryTokens: string[]): Map<string, { score: number; matches: string[] }> {
    const scores = new Map<string, { score: number; matches: string[] }>();
    const N = this.chunks.size;

    for (const token of queryTokens) {
      const postingList = this.invertedIndex.get(token);
      if (!postingList || postingList.size === 0) continue;

      const n = postingList.size;
      // Standard Okapi BM25 IDF formula
      const idf = Math.log((N - n + 0.5) / (n + 0.5) + 1);

      for (const chunkId of postingList) {
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
   * Hybrid Search using Reciprocal Rank Fusion (RRF)
   */
  public query(queryText: string, topK: number = 5): RetrievalResult[] {
    const queryTokens = this.tokenize(queryText);
    const queryEmbedding = this.computeLightweightEmbedding(queryTokens);

    // 1. BM25 Ranking
    const bm25Map = this.scoreBM25(queryTokens);
    const bm25Sorted = Array.from(bm25Map.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .map(([chunkId, data], idx) => ({ chunkId, rank: idx + 1, score: data.score, matches: data.matches }));

    // 2. Vector Ranking
    const vectorScores: { chunkId: string; score: number }[] = [];
    for (const [chunkId, chunk] of this.chunks.entries()) {
      if (chunk.embedding) {
        const sim = this.cosineSimilarity(queryEmbedding, chunk.embedding);
        vectorScores.push({ chunkId, score: sim });
      }
    }
    const vectorSorted = vectorScores
      .sort((a, b) => b.score - a.score)
      .map((item, idx) => ({ chunkId: item.chunkId, rank: idx + 1, score: item.score }));

    // 3. Reciprocal Rank Fusion (RRF)
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

    // 4. Return topK
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

  private computeLightweightEmbedding(tokens: string[]): number[] {
    const dim = 64;
    const vec = new Array(dim).fill(0);
    for (const token of tokens) {
      const hash = crypto.createHash('md5').update(token).digest();
      for (let i = 0; i < dim; i++) {
        vec[i] += (hash[i % hash.length] - 128) / 128.0;
      }
    }
    // Normalize
    const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0));
    return norm > 0 ? vec.map(v => v / norm) : vec;
  }

  public listDocuments(): { id: string; title: string; chunksCount: number; totalTokens: number }[] {
    const docMap = new Map<string, { id: string; title: string; chunksCount: number; totalTokens: number }>();
    for (const chunk of this.chunks.values()) {
      const existing = docMap.get(chunk.documentId) || {
        id: chunk.documentId,
        title: chunk.documentTitle,
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
    const toDeleteChunkIds: string[] = [];
    for (const [chunkId, chunk] of this.chunks.entries()) {
      if (chunk.documentId === documentId) {
        toDeleteChunkIds.push(chunkId);
      }
    }
    if (toDeleteChunkIds.length === 0) return false;

    for (const chunkId of toDeleteChunkIds) {
      this.chunks.delete(chunkId);
      this.docLengths.delete(chunkId);
    }

    // Clean inverted index
    for (const [term, postingSet] of this.invertedIndex.entries()) {
      for (const chunkId of toDeleteChunkIds) {
        postingSet.delete(chunkId);
      }
      if (postingSet.size === 0) {
        this.invertedIndex.delete(term);
      }
    }

    // Recalculate avgDocLength
    let totalLen = 0;
    for (const len of this.docLengths.values()) {
      totalLen += len;
    }
    this.avgDocLength = this.docLengths.size > 0 ? totalLen / this.docLengths.size : 1;

    return true;
  }

  public clearDocuments(): void {
    this.chunks.clear();
    this.invertedIndex.clear();
    this.docLengths.clear();
    this.avgDocLength = 0;
  }

  public getStats() {
    return {
      totalDocuments: new Set(Array.from(this.chunks.values()).map(c => c.documentId)).size,
      totalChunks: this.chunks.size,
      vocabularySize: this.invertedIndex.size,
      avgChunkLength: Math.round(this.avgDocLength)
    };
  }
}
