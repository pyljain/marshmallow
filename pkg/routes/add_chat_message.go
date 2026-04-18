package routes

import (
	"log"
	"net/http"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/labstack/echo/v4"
)

type ChatMessageRequest struct {
	Message        string   `json:"message"`
	KnowledgeBases []string `json:"knowledgeBases"`
}

func (r *router) AddChatMessage(c echo.Context) error {
	req := ChatMessageRequest{}

	err := c.Bind(&req)
	if err != nil {
		return err
	}

	log.Printf("Knowledgebases sent from the frontend are %+v", req.KnowledgeBases)

	sessionId := c.Param("sessionId")

	// Update session in the database
	session, err := r.database.GetSession(c.Request().Context(), sessionId)
	if err != nil {
		return err
	}

	// Update history and possibly knowledgeBases
	session.History = append(session.History, &anthropic.MessageParam{
		Role: anthropic.MessageParamRoleUser,
		Content: []anthropic.ContentBlockParamUnion{
			anthropic.NewTextBlock(req.Message),
		},
	})

	err = r.database.UpdateSession(c.Request().Context(), session)
	if err != nil {
		return err
	}

	knowledgeBases, err := r.database.GetKnowledgeBases(req.KnowledgeBases)
	if err != nil {
		return err
	}

	// Invoke LLM callout & loop until there are no more tool calls
	err = r.llm.Chat(c.Request().Context(), session.Model, &session.History, knowledgeBases)
	if err != nil {
		return err
	}

	// Update history in table
	err = r.database.UpdateSession(c.Request().Context(), session)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, session.History)
}
