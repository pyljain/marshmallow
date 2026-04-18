package search

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"marshmallow/pkg/config"
	"net/http"
	"net/url"
	"sync"
)

type SearchResponse struct {
	Responses []Response `json:"responses"`
}

type Response struct {
	Store   string   `json:"store"`
	Results []string `json:"results,omitempty"`
	Error   *string  `json:"error,omitempty"`
}

func Search(ctx context.Context, config *config.Config, knowledgeBaseId int, searchString string) (*SearchResponse, error) {
	if searchString == "" {
		return nil, fmt.Errorf("Search sring is required")
	}

	log.Printf("Knowledge base ID that'll be used to search is %d", knowledgeBaseId)

	searchResponse := SearchResponse{}
	lock := sync.Mutex{}
	wg := sync.WaitGroup{}

	for _, store := range config.Stores {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if store.EndPoint == "" {
				return
			}

			encodedSearchString := url.QueryEscape(searchString)
			resp, err := http.Get(fmt.Sprintf("%s?kb=%d&q=%s", store.EndPoint, knowledgeBaseId, encodedSearchString))
			if err != nil {
				log.Printf("Unable to get a result from store: %s. Error: %s", store.Name, err)
				errString := fmt.Sprintf("Error fetching results. %s", err.Error())
				lock.Lock()
				searchResponse.Responses = append(searchResponse.Responses, Response{
					Store:   store.Name,
					Results: nil,
					Error:   &errString,
				})

				lock.Unlock()
				return
			}

			var storeResponse []string

			err = json.NewDecoder(resp.Body).Decode(&storeResponse)
			if err != nil {
				errString := fmt.Sprintf("Error fetching results. %s", err.Error())
				lock.Lock()
				searchResponse.Responses = append(searchResponse.Responses, Response{
					Store:   store.Name,
					Results: nil,
					Error:   &errString,
				})

				lock.Unlock()
				return
			}

			lock.Lock()
			searchResponse.Responses = append(searchResponse.Responses, Response{
				Store:   store.Name,
				Results: storeResponse,
				Error:   nil,
			})

			lock.Unlock()
		}()

	}

	wg.Wait()

	return &searchResponse, nil

}
