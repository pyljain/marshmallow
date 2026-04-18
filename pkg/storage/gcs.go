package storage

import (
	"context"
	"fmt"
	"io"

	"cloud.google.com/go/storage"
)

type gcsStorage struct {
	bucketName string
	client     *storage.Client
}

var _ Storage = (*gcsStorage)(nil)

func newGCS(ctx context.Context, bucketName string) (*gcsStorage, error) {
	client, err := storage.NewClient(ctx)
	if err != nil {
		return nil, err
	}

	return &gcsStorage{
		bucketName: bucketName,
		client:     client,
	}, nil
}

func (s *gcsStorage) AddArticle(ctx context.Context, kbId, articleId int, contents []byte) error {
	bucket := s.client.Bucket(s.bucketName)
	objectName := fmt.Sprintf("%d/%d", kbId, articleId)

	obj := bucket.Object(objectName)
	w := obj.NewWriter(ctx)
	defer w.Close()

	_, err := w.Write(contents)
	if err != nil {
		return err
	}

	return nil
}

func (s *gcsStorage) GetArticle(ctx context.Context, kbId, articleId int) ([]byte, error) {
	bucket := s.client.Bucket(s.bucketName)
	objectName := fmt.Sprintf("%d/%d", kbId, articleId)

	obj := bucket.Object(objectName)
	reader, err := obj.NewReader(ctx)
	if err != nil {
		return nil, err
	}

	dataBytes, err := io.ReadAll(reader)
	return dataBytes, err
}
