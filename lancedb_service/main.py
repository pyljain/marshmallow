import fire
import io
import lancedb
import json
from .redis import Redis
import logging
import threading
import uvicorn
from lancedb.embeddings import get_registry
from lancedb.pydantic import LanceModel, Vector
from google.cloud import storage
from pypdf import PdfReader
from chonkie import TokenChunker
from fastapi import FastAPI

db_name="./data/marshmallow.lancedb"

# Connect to lancedb
ldb = lancedb.connect(db_name)

app = FastAPI()

MINIMUM_ROWS_FOR_INDEX = 256

@app.get("/api/v1/search")
async def search(q: str, kb: int):
    logging.error(f"Called search with q = {q} and kb = {kb}")
    table = ldb.open_table(f"kb_{kb}")
    results = (
        table.search(query=q, query_type="hybrid", vector_column_name="content_vector")
             .select(["article_id", "parent_id", "parent_content"])
             .limit(20)
             .to_list()
    )
    seen, unique = set(), []
    for r in results:
        if r["parent_id"] not in seen:
            seen.add(r["parent_id"])
            unique.append(r["parent_content"])
            if len(unique) == 5:
                break
    logging.error(f"Results are {unique}")
    return unique

embeddings = get_registry().get("openai").create(name="text-embedding-ada-002")

class DocumentChunk(LanceModel):
    chunk_id: str
    parent_id: str
    article_id: int
    name: str
    child_content: str = embeddings.SourceField()
    parent_content: str
    content_vector: Vector(embeddings.ndims()) = embeddings.VectorField()

def run_listener(
        redis_host="localhost", redis_port=6379, 
        indexing_queue_name="lanceDB-index", bucket_name="marshmallow-kb", results_queue_name="lanceDB-status"):

    # Connect to GCS
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    
    redis_client = Redis(redis_host, redis_port, indexing_queue_name, results_queue_name)
    
    # Instantiate parent/child chunkers
    parent_chunker = TokenChunker(chunk_size=1000, chunk_overlap=100)
    child_chunker  = TokenChunker(chunk_size=200,  chunk_overlap=0)
    
    while True:
        # Listen to redis queue
        print(f"Listening for message on queue {indexing_queue_name}")
        indexing_request = redis_client.get_message()

        kbid = indexing_request["knowledgeBaseId"]
        articleid = indexing_request["articleId"]

        print(f"Got message for kbid = {kbid}, articleid = {articleid}")

        redis_client.send_status_update(articleid, "Indexing", "Indexing successful")

        try:
            # Fetch file from GCS
            blob_ref = bucket.blob(f"{kbid}/{articleid}")
            file_bytes = blob_ref.download_as_bytes()
            print(f"Downloading file from GCS")

            # Create table schema
            table_name = f"kb_{kbid}"
            if table_name not in ldb.table_names():
                table = ldb.create_table(table_name, schema=DocumentChunk, mode="overwrite")
            else:
                table = ldb.open_table(table_name)
            
            # Extract text from PDF
            reader = PdfReader(io.BytesIO(file_bytes))

            print(f"Writing chunks to lancedb")
            all_docs = []
            for page_num, page in enumerate(reader.pages):
                pdf_text = page.extract_text()
                parent_chunks = parent_chunker(pdf_text)

                for p_idx, parent_chunk in enumerate(parent_chunks):
                    parent_id = f"{articleid}_{page_num}_{p_idx}"
                    child_chunks = child_chunker(parent_chunk.text)

                    for c_idx, child_chunk in enumerate(child_chunks):
                        all_docs.append({
                            "chunk_id":       f"{parent_id}_{c_idx}",
                            "parent_id":      parent_id,
                            "article_id":     articleid,
                            "name":           indexing_request["articleName"],
                            "child_content":  child_chunk.text,
                            "parent_content": parent_chunk.text,
                        })

            table.add(data=all_docs)

            table.create_fts_index("child_content", replace=True)

            if len(table) >= MINIMUM_ROWS_FOR_INDEX:
                table.create_index(
                    metric="cosine",
                    num_partitions=max(1, int(len(table) ** 0.5)),
                    num_sub_vectors=48,
                    replace=True
                )

            # Write result back to redis
            redis_client.send_status_update(articleid, "Completed", "Indexing successful")
        except Exception as e:
            print(e)
            redis_client.send_status_update(articleid, "Error", str(e))

def run(
        redis_host="localhost", redis_port=6379,
        indexing_queue_name="lanceDB-index", bucket_name="marshmallow-kb",
        results_queue_name="lanceDB-status",
        api_host="0.0.0.0", api_port=9001):

    listener_thread = threading.Thread(
        target=run_listener,
        kwargs=dict(
            redis_host=redis_host,
            redis_port=redis_port,
            indexing_queue_name=indexing_queue_name,
            bucket_name=bucket_name,
            results_queue_name=results_queue_name,
        ),
        daemon=True,
    )
    listener_thread.start()

    uvicorn.run(app, host=api_host, port=api_port)

if __name__ == '__main__':
    fire.Fire(run)