package main

import (
	"context"
	"flag"
	"log"
	"log/slog"
	"marshmallow/pkg/config"
	"marshmallow/pkg/db"
	"marshmallow/pkg/llm"
	"marshmallow/pkg/queue"
	"marshmallow/pkg/routes"
	"marshmallow/pkg/storage"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {

	var configPath string
	ctx := context.Background()

	flag.StringVar(&configPath, "config", "", "Location of the config file")
	flag.Parse()

	e := echo.New()

	// Middleware
	e.Use(middleware.RequestLogger())
	e.Use(middleware.Recover())

	db, err := db.NewSQLite("./data/kb-service.sqlite")
	if err != nil {
		log.Fatalf("Not able to instantiate a new DB %s", err)
	}

	config, err := config.LoadConfig(configPath)
	if err != nil {
		log.Fatalf("Error reading config file %s", err)
	}

	queue, err := queue.GetQueue(ctx, config.Queue.Type, config.Queue.ConnectionString)
	if err != nil {
		log.Fatalf("Error setting up a queue client %s", err)
	}

	storage, err := storage.GetStorage(ctx, config.Storage.Type, config.Storage.ConnectionString)
	if err != nil {
		log.Fatalf("Error setting up a storage client %s", err)
	}

	toolRegistry := llm.NewToolRegistry(config)

	llm, err := llm.NewLLM(toolRegistry)
	if err != nil {
		log.Fatalf("Error setting up LLM %s", err)
	}

	// Start service to monitor updates from indexing status queues
	for _, store := range config.Stores {
		storeChan, err := queue.SubscribeToStatusUpdates(ctx, store.StatusQueue)
		if err != nil {
			log.Printf("Unable to sunscribe to the status update channel for store:%s with error: %s", store.Name, err)
			continue
		}

		go func() {
			for msg := range storeChan {
				err = db.UpdateArticleIndexingStatus(msg.ArticleId, store.Name, msg.Status, msg.Message)
				if err != nil {
					log.Printf("Unable to update article status in DB for store: %s with error: %s", store.Name, err)
					continue
				}
			}
		}()
	}

	rt := routes.NewRouter(db, storage, queue, config, llm)

	// Routes
	e.GET("/api/v1/kb/:kb/knowledge/:articleId", rt.GetArticleDetails)
	e.GET("/api/v1/kb", rt.GetKnowledgeBases)
	e.DELETE("/api/v1/kb/:kb/knowledge/:articleId", rt.DeleteArticle)
	e.POST("/api/v1/kb/:kb/knowledge", rt.IndexArticle)
	e.POST("/api/v1/kb", rt.CreateKnowledgeBase)
	e.GET("/api/v1/kb/:kb/search", rt.Search)

	// Chat routes
	e.GET("/api/v1/sessions", rt.GetAllSessions)
	e.GET("/api/v1/sessions/:sessionId", rt.GetSession)
	e.POST("/api/v1/sessions", rt.CreateSession)
	e.POST("/api/v1/sessions/:sessionId/chat", rt.AddChatMessage)

	// e.POST("/api/v1/kb/{kbId}/members", rt.AddMember)

	// Start server
	if err := e.Start(":8080"); err != nil {
		slog.Error("failed to start server", "error", err)
	}
}
