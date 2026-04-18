package models

type KnowledgeBase struct {
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	FriendlyName string    `json:"friendlyName"`
	Id           int       `json:"id"`
	Articles     []Article `json:"articles"`
}
