from sqlmodel import Session, select
from models.document import DocumentChunk
from typing import List
from dataclasses import dataclass


@dataclass
class SearchResult:
    content: str
    document_id: str
    chunk_index: int
    score: float = 0.0


class RAGService:
    def search_documents(
        self, db: Session, query: str, top_k: int = 5
    ) -> List[SearchResult]:
        """Search for relevant document chunks"""

        keywords = query.lower().split()
        chunks = db.exec(select(DocumentChunk)).all()

        results = []
        for chunk in chunks:
            content_lower = chunk.content.lower()
            score = sum(1 for keyword in keywords if keyword in content_lower)

            if score > 0:
                results.append(
                    SearchResult(
                        content=chunk.content,
                        document_id=chunk.document_id,
                        chunk_index=chunk.chunk_index,
                        score=score,
                    )
                )

        results.sort(key=lambda x: x.score, reverse=True)
        return results[:top_k]

    def get_context(
        self, db: Session, query: str, top_k: int = 5
    ) -> tuple[List[str], List[dict]]:
        """Get context strings and source info for RAG"""

        results = self.search_documents(db, query, top_k)

        contexts = [r.content for r in results]
        sources = [
            {
                "document_id": r.document_id,
                "chunk_index": r.chunk_index,
                "preview": r.content[:100] + "..."
                if len(r.content) > 100
                else r.content,
            }
            for r in results
        ]

        return contexts, sources


rag_service = RAGService()
