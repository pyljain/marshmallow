package db

import (
	"context"
	"marshmallow/pkg/models"
)

type DB interface {
	CreateKnowledgeBase(name, description string) (string, error)
	CreateArticle(knowledgeBaseId int, articleName string) (int, error)
	GetKBIdFromFriendlyName(friendlyName string) (int, error)
	GetKnowledgeBases(friendlyNames []string) ([]*models.KnowledgeBase, error)
	UpdateArticleIndexingStatus(articleId int, name string, status string, message string) error
	GetSession(ctx context.Context, sessionId string) (*models.Session, error)
	GetAllSessions(ctx context.Context) ([]*models.Session, error)
	CreateSession(ctx context.Context, req *models.Session) (string, error)
	UpdateSession(ctx context.Context, session *models.Session) error
}
