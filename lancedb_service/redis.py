import json
import logging
import redis

class Redis:

    redis_client: redis.Redis
    indexing_queue_name: str
    results_queue_name: str
    
    def __init__(self, redis_host: str, redis_port: int, indexing_queue_name: str, results_queue_name: str):
        # Connect to redis
        redis_client = redis.Redis(host=redis_host, port=redis_port, db=0, protocol=3)
        try:
            redis_client.ping()
        except Exception as e:
            logging.error(f"Error connecting to redis {e}")
            return
        
        self.redis_client = redis_client
        self.indexing_queue_name = indexing_queue_name
        self.results_queue_name = results_queue_name
        
    def get_message(self) -> dict:
        value_list = self.redis_client.brpop(self.indexing_queue_name, 0)
        return json.loads(value_list[1])

    def send_status_update(self, article_id: str, status: str, message: str = ""):
        self.redis_client.lpush(self.results_queue_name, json.dumps({
            "articleId": int(article_id),
            "status": status,
            "message": message
        }))