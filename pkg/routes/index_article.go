package routes

import (
	"encoding/base64"
	"log"
	"marshmallow/pkg/models"

	"github.com/labstack/echo/v4"
)

type ArticleRequest struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

func (rt *router) IndexArticle(c echo.Context) error {
	kbName := c.Param("kb")

	ar := ArticleRequest{}
	err := c.Bind(&ar)
	if err != nil {
		return err
	}

	// Insert into local database in the Articles table
	kbId, err := rt.database.GetKBIdFromFriendlyName(kbName)
	if err != nil {
		return err
	}

	articleID, err := rt.database.CreateArticle(kbId, ar.Name)
	if err != nil {
		return err
	}

	// Insert into object storage
	contentBytes, err := base64.StdEncoding.DecodeString(ar.Content)
	if err != nil {
		return err
	}

	err = rt.storage.AddArticle(c.Request().Context(), kbId, articleID, contentBytes)
	if err != nil {
		return err
	}

	// Put message into the queue for each configured backend
	indexingRequest := &models.IndexingRequest{
		ArticleID:       articleID,
		KnowledgebaseId: kbId,
		ArticleName:     ar.Name,
	}

	for _, store := range rt.config.Stores {
		err = rt.queue.PublishIndexingRequest(c.Request().Context(), indexingRequest, store.IndexingQueue)
		if err != nil {
			log.Printf("Queue publishing failed %s", err)
			return err
		}
		err = rt.database.UpdateArticleIndexingStatus(articleID, store.Name, "Queued", "")
		if err != nil {
			log.Printf("Article indexing db update failed %s", err)
			return err
		}
	}

	return nil
}
