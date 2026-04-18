package queue

import (
	"context"
	"fmt"
	"marshmallow/pkg/models"
)

type Queue interface {
	PublishIndexingRequest(ctx context.Context, req *models.IndexingRequest, queueName string) error
	SubscribeToStatusUpdates(ctx context.Context, queueName string) (chan models.ArticleIndexingStatus, error)
	SubscribeToIndexingRequests(ctx context.Context, queueName string) (chan models.IndexingRequest, error)
	PublishStatusUpdates(ctx context.Context, queueName string, update models.ArticleIndexingStatus) error
}

func GetQueue(ctx context.Context, queueType, connectionstring string) (Queue, error) {
	switch queueType {
	case "redis":
		return NewRedis(ctx, connectionstring)
	default:
		return nil, fmt.Errorf("QueueType must be passed and valid")
	}
}
