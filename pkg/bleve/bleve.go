package bleve

import (
	"fmt"
	"io/fs"
	"log"
	"marshmallow/pkg/models"
	"marshmallow/pkg/utils"
	"path"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/blevesearch/bleve/v2"
)

type Index struct {
	indexes       map[int]bleve.Index
	rootDirectory string
}

func New(rootDirectory string) (*Index, error) {
	indexes := make(map[int]bleve.Index)
	err := filepath.WalkDir(rootDirectory, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if !d.IsDir() {
			return nil
		}

		if filepath.Ext(path) == ".bleve" {
			log.Printf("Opening bleve index %s", path)
			index, err := bleve.Open(path)
			if err != nil {
				return err
			}
			log.Printf("Opened bleve index %s", path)

			kbIDString := strings.Replace(filepath.Base(path), ".bleve", "", -1)
			kbID, err := strconv.Atoi(kbIDString)
			if err != nil {
				return err
			}

			log.Printf("Setting index for KBID in map. KBID = %d", kbID)
			indexes[kbID] = index
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	return &Index{indexes, rootDirectory}, nil
}

func (i *Index) Add(req *models.IndexingRequest, articleBytes []byte) error {
	log.Printf("Indexing request received for knowledgebase %d", req.KnowledgebaseId)
	var err error
	var index bleve.Index
	index, exists := i.indexes[req.KnowledgebaseId]
	if !exists {
		mapping := bleve.NewIndexMapping()
		index, err = bleve.New(path.Join(i.rootDirectory, fmt.Sprintf("%d.bleve", req.KnowledgebaseId)), mapping)
		if err != nil {
			return err
		}
		i.indexes[req.KnowledgebaseId] = index
	}

	// Extract text from file
	log.Printf("Extracting text from PDF")
	contentToIndexForFile, err := utils.ExtractPDFContent(articleBytes)
	if err != nil {
		return err
	}

	log.Printf("Extracted text from PDF %s", contentToIndexForFile)

	err = index.Index(fmt.Sprintf("%d", req.ArticleID), Article{
		Id:      req.ArticleID,
		Name:    req.ArticleName,
		Content: contentToIndexForFile,
	})
	if err != nil {
		return err
	}

	return nil
}

func (i *Index) Search(searchString string, kbId int) ([]string, error) {
	kbIndex, exists := i.indexes[kbId]
	if !exists {
		return nil, fmt.Errorf("Invalid KB ID")
	}

	query := bleve.NewQueryStringQuery(searchString)
	searchRequest := bleve.NewSearchRequest(query)
	searchRequest.Fields = []string{"content"}
	searchResult, err := kbIndex.Search(searchRequest)
	if err != nil {
		log.Println(err)
		return nil, err
	}

	results := []string{}

	for i, hit := range searchResult.Hits {
		if i > 5 {
			break
		}
		content := hit.Fields["content"].(string)
		results = append(results, content)
	}

	return results, nil
}

func (i *Index) Close() error {
	for _, i := range i.indexes {
		err := i.Close()
		if err != nil {
			return err
		}
	}

	return nil
}
