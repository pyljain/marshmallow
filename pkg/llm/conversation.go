package llm

import (
	"context"
	"encoding/json"
	"marshmallow/pkg/models"
	"text/template"

	"github.com/anthropics/anthropic-sdk-go" // imported as anthropic

	_ "embed"
)

//go:embed system_prompt.txt
var systemPrompt string

type LLM struct {
	client               anthropic.Client
	systemPromptTemplate *template.Template
	toolRegistry         *ToolRegistry
	toolParams           []anthropic.ToolParam
}

func NewLLM(toolRegistry *ToolRegistry) (*LLM, error) {
	client := anthropic.NewClient()
	systemPromptTemplate, err := getSystemPromptTemplate()
	if err != nil {
		return nil, err
	}

	toolParams := toolRegistry.GetAllSchemas()

	return &LLM{
		client:               client,
		systemPromptTemplate: systemPromptTemplate,
		toolRegistry:         toolRegistry,
		toolParams:           toolParams,
	}, nil
}

func (l *LLM) Chat(ctx context.Context, model string, history *[]*anthropic.MessageParam, kb []*models.KnowledgeBase) error {
	hydratedSystemPrompt, err := getSystemPrompt(l.systemPromptTemplate, kb)
	if err != nil {
		return err
	}

	tools := make([]anthropic.ToolUnionParam, len(l.toolParams))
	for i, toolParam := range l.toolParams {
		tools[i] = anthropic.ToolUnionParam{OfTool: &toolParam}
	}

	for {
		var historyForModel []anthropic.MessageParam
		for _, h := range *history {
			historyForModel = append(historyForModel, *h)
		}

		resp, err := l.client.Messages.New(ctx, anthropic.MessageNewParams{
			MaxTokens: 6500,
			Messages:  historyForModel,
			Model:     model,
			System: []anthropic.TextBlockParam{
				{
					Text: hydratedSystemPrompt,
				},
			},
			Tools: tools,
		})

		if err != nil {
			return err
		}

		respParam := resp.ToParam()
		*history = append(*history, &respParam)

		toolResults := []anthropic.ContentBlockParamUnion{}
		// Check if tool calls are present
		var toolsCalled bool
		for _, block := range resp.Content {
			switch block := block.AsAny().(type) {
			case anthropic.ToolUseBlock:
				var input map[string]any
				err := json.Unmarshal([]byte(block.JSON.Input.Raw()), &input)
				if err != nil {
					return err
				}

				toolToExecute, err := l.toolRegistry.GetToolByName(block.Name)
				if err != nil {
					return err
				}

				toolResponse, err := toolToExecute.Execute(ctx, input)
				if err != nil {
					toolResults = append(toolResults, anthropic.NewToolResultBlock(block.ID, err.Error(), true))
					return err
				} else {
					toolResults = append(toolResults, anthropic.NewToolResultBlock(block.ID, toolResponse, false))
				}

				toolsCalled = true
			}
		}

		if !toolsCalled {
			break
		}

		userMessage := anthropic.NewUserMessage(toolResults...)
		*history = append(*history, &userMessage)
	}

	return nil
}
