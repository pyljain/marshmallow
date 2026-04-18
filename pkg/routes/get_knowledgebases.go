package routes

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

func (rt *router) GetKnowledgeBases(c echo.Context) error {

	knowledgeBases, err := rt.database.GetKnowledgeBases([]string{})
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, knowledgeBases)
}
