package models

type IndexingRequest struct {
	ArticleID       int    `json:"articleId"`
	KnowledgebaseId int    `json:"knowledgeBaseId"`
	ArticleName     string `json:"articleName"`
}
