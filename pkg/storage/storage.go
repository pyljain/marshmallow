package storage

import (
	"context"
	"fmt"
)

type Storage interface {
	AddArticle(ctx context.Context, kbId, articleId int, contents []byte) error
	GetArticle(ctx context.Context, kbId, articleId int) ([]byte, error)
}

func GetStorage(ctx context.Context, storageType string, bucketName string) (Storage, error) {
	switch storageType {
	case "gcs":
		return newGCS(ctx, bucketName)
	default:
		return nil, fmt.Errorf("storage %s not found", storageType)
	}
}
