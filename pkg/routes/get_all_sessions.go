package routes

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

func (rt *router) GetAllSessions(c echo.Context) error {
	sessions, err := rt.database.GetAllSessions(c.Request().Context())
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, sessions)

}
