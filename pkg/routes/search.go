package routes

import (
	"fmt"
	"marshmallow/pkg/search"
	"net/http"

	"github.com/labstack/echo/v4"
)

func (rt *router) Search(c echo.Context) error {
	kbName := c.Param("kb")
	searchString := c.QueryParam("q")

	if searchString == "" {
		return fmt.Errorf("Search sring is required")
	}

	kbId, err := rt.database.GetKBIdFromFriendlyName(kbName)
	if err != nil {
		return err
	}

	searchResponse, err := search.Search(c.Request().Context(), rt.config, kbId, searchString)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, searchResponse)
}
