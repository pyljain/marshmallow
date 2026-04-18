package main

import (
	"context"
	"encoding/json"
	"flag"
	"log"
	"marshmallow/pkg/bleve"
	"marshmallow/pkg/models"
	"marshmallow/pkg/queue"
	"marshmallow/pkg/storage"
	"net/http"
	"os"
	"strconv"

	"golang.org/x/sync/errgroup"
)

func main() {
	ctx := context.Background()
	// Initialise Redis Client
	var redisConnectionString string
	var indexingQueueName string
	var statusQueueName string
	var bucket string
	var dataDirectory string

	flag.StringVar(&redisConnectionString, "redis", "localhost:6379", "Redis connection string for Bleve")
	flag.StringVar(&indexingQueueName, "indexing-queue", "bleve-index", "Queue with indexing request details")
	flag.StringVar(&statusQueueName, "status-queue", "bleve-status", "Queue to send status updates to")
	flag.StringVar(&bucket, "bucket", "marshmallow-kb", "Storage bucket that store files")
	flag.StringVar(&dataDirectory, "data-directory", "./data/bleve", "Parent directory for Bleve indexes")
	flag.Parse()

	if redisConnectionString == "" {
		log.Printf("You must provide a Redis connection string")
		os.Exit(1)
	}

	index, err := bleve.New(dataDirectory)
	if err != nil {
		log.Printf("Error loading indexes %s", err)
		os.Exit(1)
	}
	defer index.Close()

	redisQueue, err := queue.GetQueue(ctx, "redis", redisConnectionString)
	if err != nil {
		log.Printf("Error initialising Redis Queue %s", err)
		os.Exit(1)
	}

	storageClient, err := storage.GetStorage(ctx, "gcs", bucket)
	if err != nil {
		log.Printf("Error initialising storage client %s", err)
		os.Exit(1)
	}

	log.Printf("BLEVE subscribing to queue for queuename %s", indexingQueueName)
	indexingRequestsChan, err := redisQueue.SubscribeToIndexingRequests(ctx, indexingQueueName)
	if err != nil {
		log.Printf("Unable to pull indexing requests from Redis %s", err)
		os.Exit(1)
	}

	eg, egCtx := errgroup.WithContext(ctx)
	eg.Go(func() error {
		for req := range indexingRequestsChan {
			statusUpdate := models.ArticleIndexingStatus{
				Name:      req.ArticleName,
				ArticleId: req.ArticleID,
				Status:    "Indexing",
				Message:   "Received indexing request",
			}

			err = redisQueue.PublishStatusUpdates(egCtx, statusQueueName, statusUpdate)
			if err != nil {
				log.Printf("Unable to send status update %s", err)
				statusUpdate.Status = "Error"
				statusUpdate.Message = err.Error()
				err = redisQueue.PublishStatusUpdates(egCtx, statusQueueName, statusUpdate)
				if err != nil {
					log.Printf("Unable to send status update %s", err)
					continue
				}
				continue
			}

			log.Printf("Bleve picking up a request from the channel")
			// Get file to index from GCS
			articleBytes, err := storageClient.GetArticle(egCtx, req.KnowledgebaseId, req.ArticleID)
			if err != nil {
				log.Printf("Unable to read from storage %s", err)
				statusUpdate.Status = "Error"
				statusUpdate.Message = err.Error()
				err = redisQueue.PublishStatusUpdates(egCtx, statusQueueName, statusUpdate)
				if err != nil {
					log.Printf("Unable to send status update %s", err)
					continue
				}
				continue
			}

			// Index in bleve
			err = index.Add(&req, articleBytes)
			if err != nil {
				log.Printf("Unable to index data in bleve %s", err)
				statusUpdate.Status = "Error"
				statusUpdate.Message = err.Error()
				err = redisQueue.PublishStatusUpdates(egCtx, statusQueueName, statusUpdate)
				if err != nil {
					log.Printf("Unable to send status update %s", err)
					continue
				}
				continue
			}

			statusUpdate.Status = "Completed"
			statusUpdate.Message = "Indexing complete"
			err = redisQueue.PublishStatusUpdates(egCtx, statusQueueName, statusUpdate)
			if err != nil {
				log.Printf("Unable to send status update %s", err)
				continue
			}

		}

		return nil
	})

	eg.Go(func() error {
		http.HandleFunc("/api/v1/search", func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodGet {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				return
			}

			queryParams := r.URL.Query()
			searchString := queryParams["q"][0]
			kb := queryParams["kb"][0]
			kbId, err := strconv.Atoi(kb)
			if err != nil {
				http.Error(w, "Invalid KnowledgeBase", http.StatusBadRequest)
				return
			}
			results, err := index.Search(searchString, kbId)
			if err != nil {
				http.Error(w, "Server error occured while retrieving results", http.StatusInternalServerError)
				return
			}

			resBytes, err := json.Marshal(results)
			if err != nil {
				http.Error(w, "Server error occured while retrieving results", http.StatusInternalServerError)
				return
			}

			w.Write(resBytes)

		})

		err := http.ListenAndServe(":9100", nil)
		if err != nil {
			return err
		}

		return nil
	})

	err = eg.Wait()
	if err != nil {
		log.Fatalf("Error: %s", err)
		return
	}
}
