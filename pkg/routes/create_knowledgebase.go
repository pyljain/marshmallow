package routes

import (
	"marshmallow/pkg/models"
	"net/http"

	"github.com/labstack/echo/v4"
)

func (rt *router) CreateKnowledgeBase(c echo.Context) error {
	var kb models.KnowledgeBase
	err := c.Bind(&kb)
	if err != nil {
		return err
	}

	friendlyName, err := rt.database.CreateKnowledgeBase(kb.Name, kb.Description)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusCreated, map[string]string{
		"knowledgebase": friendlyName,
	})
}
