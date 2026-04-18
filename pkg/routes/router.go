package routes

import (
	"marshmallow/pkg/config"
	"marshmallow/pkg/db"
	"marshmallow/pkg/llm"
	"marshmallow/pkg/queue"
	"marshmallow/pkg/storage"
)

type router struct {
	database db.DB
	config   *config.Config
	storage  storage.Storage
	queue    queue.Queue
	llm      *llm.LLM
}

func NewRouter(database db.DB, storage storage.Storage, queue queue.Queue, config *config.Config, llm *llm.LLM) *router {
	return &router{
		database: database,
		storage:  storage,
		queue:    queue,
		config:   config,
		llm:      llm,
	}
}
