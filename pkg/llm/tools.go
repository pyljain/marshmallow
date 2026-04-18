package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"marshmallow/pkg/config"
	"marshmallow/pkg/search"

	"github.com/anthropics/anthropic-sdk-go"
)

type Tool interface {
	Name() string
	Schema() anthropic.ToolParam
	Execute(ctx context.Context, input map[string]any) (string, error)
}

type ToolRegistry struct {
	tools map[string]Tool
}

func NewToolRegistry(config *config.Config) *ToolRegistry {
	tools := make(map[string]Tool)

	tools["search_knowledgebase"] = &KnowledgeBaseSearchTool{config: config}
	return &ToolRegistry{
		tools: tools,
	}
}

func (r *ToolRegistry) GetAllSchemas() []anthropic.ToolParam {
	var result []anthropic.ToolParam
	for _, schema := range r.tools {
		result = append(result, schema.Schema())
	}

	return result
}

func (r *ToolRegistry) GetToolByName(name string) (Tool, error) {
	val, exists := r.tools[name]
	if !exists {
		return nil, fmt.Errorf("tool not found")
	}

	return val, nil
}

type KnowledgeBaseSearchTool struct {
	config *config.Config
}

func (k *KnowledgeBaseSearchTool) Name() string {
	return "search_knowledgebase"
}

func (k *KnowledgeBaseSearchTool) Schema() anthropic.ToolParam {
	return anthropic.ToolParam{
		Name:        "search_knowledgebase",
		Description: anthropic.String("Hybrid search across a knowledge base with a search string"),
		InputSchema: anthropic.ToolInputSchemaParam{
			Properties: map[string]any{
				"id": map[string]any{
					"type":        "integer",
					"description": "The knowledge base ID",
				},
				"searchString": map[string]any{
					"type":        "string",
					"description": "The string to search for",
				},
			},
		},
	}
}

func (k *KnowledgeBaseSearchTool) Execute(ctx context.Context, input map[string]any) (string, error) {

	kbId := input["id"].(float64)

	searchString := input["searchString"].(string)

	searchResponse, err := search.Search(ctx, k.config, int(kbId), searchString)
	if err != nil {
		return "", err
	}

	marshalledSearchResults, err := json.Marshal(searchResponse)
	if err != nil {
		return "", err
	}

	return string(marshalledSearchResults), nil
}
