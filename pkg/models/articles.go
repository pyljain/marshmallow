package models

type Article struct {
	Id                  int                     `json:"id"`
	Name                string                  `json:"name"`
	PathInObjectStorage string                  `json:"pathInObjectStorage"`
	KnowledgeBaseId     string                  `json:"knowledgeBaseId"`
	ArticleIndexing     []ArticleIndexingStatus `json:"articleIndexing"`
}

type ArticleIndexingStatus struct {
	Name      string `json:"name"`
	ArticleId int    `json:"articleId"`
	Status    string `json:"status"`
	Message   string `json:"message"`
}
