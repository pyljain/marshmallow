package models

import "github.com/anthropics/anthropic-sdk-go"

type Session struct {
	Id             string                    `json:"id"`
	Model          string                    `json:"model"`
	KnowledgeBases []int                     `json:"knowledgeBases"`
	History        []*anthropic.MessageParam `json:"history"`
}
