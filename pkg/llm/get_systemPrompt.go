package llm

import (
	"bytes"
	"log"
	"marshmallow/pkg/models"
	"text/template"
)

func getSystemPromptTemplate() (*template.Template, error) {
	tmpl := template.New("systemPrompt")
	parsedTemplate, err := tmpl.Parse(systemPrompt)
	if err != nil {
		return nil, err
	}

	return parsedTemplate, nil
}

func getSystemPrompt(tmpl *template.Template, kb []*models.KnowledgeBase) (string, error) {
	kbMap := map[string]any{}
	kbMap["knowledgebases"] = kb

	hydratedSystemPrompt := &bytes.Buffer{}

	err := tmpl.Execute(hydratedSystemPrompt, kbMap)
	if err != nil {
		return "", err
	}

	log.Printf("Hydrated system prompt is %s", hydratedSystemPrompt)

	return hydratedSystemPrompt.String(), nil
}
