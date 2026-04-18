package queue

import (
	"context"
	"encoding/json"
	"log"
	"marshmallow/pkg/models"

	"github.com/redis/go-redis/v9"
)

type redisQueue struct {
	conn *redis.Client
}

var _ Queue = (*redisQueue)(nil)

func NewRedis(ctx context.Context, connectionString string) (*redisQueue, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     connectionString,
		Password: "",
		DB:       0,
	})

	err := rdb.Ping(ctx).Err()
	if err != nil {
		return nil, err
	}

	return &redisQueue{
		conn: rdb,
	}, nil
}

func (r *redisQueue) PublishIndexingRequest(ctx context.Context, req *models.IndexingRequest, queueName string) error {

	indexingRequestBytes, err := json.Marshal(&req)
	if err != nil {
		return err
	}
	res := r.conn.LPush(ctx, queueName, string(indexingRequestBytes))
	if res.Err() != nil {
		return res.Err()
	}

	return nil
}

func (r *redisQueue) SubscribeToStatusUpdates(ctx context.Context, queueName string) (chan models.ArticleIndexingStatus, error) {
	ch := make(chan models.ArticleIndexingStatus)
	go func() {
		for {
			res := r.conn.BRPop(ctx, 0, queueName)
			if res.Err() != nil {
				log.Printf("Error received while reading from status queue %s", res.Err())
				continue
			}

			responses, err := res.Result()
			if err != nil {
				log.Printf("Unable to get a status update from the queue %s", err)
				continue
			}

			indexingStatus := models.ArticleIndexingStatus{}
			err = json.Unmarshal([]byte(responses[1]), &indexingStatus)
			if err != nil {
				log.Printf("Unable to get a status update from the queue %s", err)
				break
			}
			ch <- indexingStatus
		}
	}()

	return ch, nil
}

func (r *redisQueue) SubscribeToIndexingRequests(ctx context.Context, queueName string) (chan models.IndexingRequest, error) {
	ch := make(chan models.IndexingRequest)
	go func() {
		for {
			res := r.conn.BRPop(ctx, 0, queueName)
			if res.Err() != nil {
				log.Printf("Error received while reading from indexing queue %s", res.Err())
				continue
			}

			responses, err := res.Result()
			if err != nil {
				log.Printf("Unable to get an indexing request from the queue %s", err)
				continue
			}

			indexingRequest := models.IndexingRequest{}
			err = json.Unmarshal([]byte(responses[1]), &indexingRequest)
			if err != nil {
				log.Printf("Unable to unmarshal the indexing request %s", err)
				break
			}
			ch <- indexingRequest
		}
	}()

	return ch, nil
}

func (r *redisQueue) PublishStatusUpdates(ctx context.Context, queueName string, update models.ArticleIndexingStatus) error {

	statusUpdateBytes, err := json.Marshal(&update)
	if err != nil {
		return err
	}
	res := r.conn.LPush(ctx, queueName, string(statusUpdateBytes))
	if res.Err() != nil {
		return res.Err()
	}

	return nil

}
