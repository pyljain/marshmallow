package routes

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

func (rt *router) GetSession(c echo.Context) error {

	sessionId := c.Param("sessionId")
	session, err := rt.database.GetSession(c.Request().Context(), sessionId)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, session)
}
