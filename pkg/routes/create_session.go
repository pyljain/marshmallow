package routes

import (
	"marshmallow/pkg/models"
	"net/http"

	"github.com/labstack/echo/v4"
)

func (rt *router) CreateSession(c echo.Context) error {
	// Unmarshal request
	req := models.Session{}
	err := c.Bind(&req)
	if err != nil {
		return nil
	}

	// Create a new session in the database
	sessionId, err := rt.database.CreateSession(c.Request().Context(), &req)
	if err != nil {
		return nil
	}

	return c.JSON(http.StatusCreated, map[string]string{
		"sessionId": sessionId,
	})
}
