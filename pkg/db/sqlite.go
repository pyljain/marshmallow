package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"marshmallow/pkg/models"
	"marshmallow/pkg/utils"
	"strings"

	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
)

type SQLite struct {
	client *sql.DB
}

var _ DB = (*SQLite)(nil)

func NewSQLite(connectionString string) (*SQLite, error) {
	conn, err := sql.Open("sqlite3", connectionString)
	if err != nil {
		return nil, err
	}

	// Create the table
	_, err = conn.Exec(`CREATE TABLE IF NOT EXISTS kb (
		id          INTEGER PRIMARY KEY AUTOINCREMENT,
		name        TEXT NOT NULL,
		description TEXT,
		friendly_name TEXT
	)`)
	if err != nil {
		return nil, err
	}

	// Create the Sessions table
	_, err = conn.Exec(`CREATE TABLE IF NOT EXISTS sessions (
		id          VARCHAR(50) PRIMARY KEY,
		model        TEXT NOT NULL,
		knowledge_bases TEXT,
		history TEXT
	)`)
	if err != nil {
		return nil, err
	}

	// Create index on friendly_name
	_, err = conn.Exec(`CREATE INDEX IF NOT EXISTS idx_kb_friendly_name 
    	ON kb (friendly_name)`)
	if err != nil {
		return nil, err
	}

	_, err = conn.Exec(`CREATE TABLE IF NOT EXISTS articles (
		id    INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT,
		status TEXT,
		kb_id INTEGER NOT NULL REFERENCES kb(id)
	)`)
	if err != nil {
		return nil, err
	}

	_, err = conn.Exec(`PRAGMA foreign_keys = ON`)
	if err != nil {
		return nil, err
	}

	_, err = conn.Exec(`CREATE INDEX IF NOT EXISTS idx_articles_kb_id ON articles(kb_id)`)
	if err != nil {
		return nil, err
	}

	_, err = conn.Exec(`CREATE TABLE IF NOT EXISTS article_indexing_statuses (
		id    INTEGER PRIMARY KEY AUTOINCREMENT,
		article_id INTEGER NOT NULL REFERENCES articles(id),
		name TEXT,
		status TEXT,
		message TEXT
	)`)
	if err != nil {
		return nil, err
	}

	return &SQLite{
		client: conn,
	}, nil
}

func (s *SQLite) CreateKnowledgeBase(name, description string) (string, error) {
	// Generate a friendly name
	friendlyName := utils.GenerateName()
	// Insert statement
	insertSQL := `INSERT INTO kb (name, description, friendly_name) VALUES (?, ?, ?)`

	_, err := s.client.Exec(insertSQL, name, description, friendlyName)
	if err != nil {
		return "", err
	}

	return friendlyName, nil
}

func (s *SQLite) CreateArticle(knowledgeBaseID int, name string) (int, error) {
	// Insert statement
	insertSQL := `INSERT INTO articles (kb_id, name, status) VALUES (?, ?, ?) RETURNING id`

	var id int
	err := s.client.QueryRow(insertSQL, knowledgeBaseID, name, "Queued").Scan(&id)
	if err != nil {
		return -1, err
	}

	return id, nil
}

func (s *SQLite) CreateSession(ctx context.Context, req *models.Session) (string, error) {
	sessionId, err := uuid.NewV7()
	if err != nil {
		return "", err
	}

	historyMarshalled, err := json.Marshal(req.History)
	if err != nil {
		return "", err
	}

	knowledgeBasesMarshalled, err := json.Marshal(req.KnowledgeBases)
	if err != nil {
		return "", err
	}

	insertSQL := `INSERT INTO sessions (id, model, knowledge_bases, history) VALUES (?, ?, ?, ?)`

	_, err = s.client.ExecContext(ctx, insertSQL, sessionId, req.Model, knowledgeBasesMarshalled, historyMarshalled)
	if err != nil {
		return "", err
	}

	return sessionId.String(), nil

}

func (s *SQLite) GetSession(ctx context.Context, sessionId string) (*models.Session, error) {
	getSQL := `SELECT ID, MODEL, KNOWLEDGE_BASES, HISTORY FROM SESSIONS WHERE ID=?`

	session := models.Session{}
	var kb string
	var history string
	err := s.client.QueryRowContext(ctx, getSQL, sessionId).Scan(&session.Id, &session.Model, &kb, &history)
	if err != nil {
		return nil, err
	}

	err = json.Unmarshal([]byte(kb), &session.KnowledgeBases)
	if err != nil {
		return nil, err
	}

	err = json.Unmarshal([]byte(history), &session.History)
	if err != nil {
		return nil, err
	}

	return &session, nil
}

func (s *SQLite) GetAllSessions(ctx context.Context) ([]*models.Session, error) {
	getSQL := `SELECT ID, MODEL, KNOWLEDGE_BASES, HISTORY FROM SESSIONS`

	rows, err := s.client.QueryContext(ctx, getSQL)
	if err != nil {
		return nil, err
	}

	sessions := []*models.Session{}
	for rows.Next() {
		session := models.Session{}
		var kb string
		var history string

		err := rows.Scan(&session.Id, &session.Model, &kb, &history)
		if err != nil {
			return nil, err
		}

		err = json.Unmarshal([]byte(kb), &session.KnowledgeBases)
		if err != nil {
			return nil, err
		}

		err = json.Unmarshal([]byte(history), &session.History)
		if err != nil {
			return nil, err
		}

		sessions = append(sessions, &session)
	}

	return sessions, nil
}

func (s *SQLite) UpdateSession(ctx context.Context, session *models.Session) error {
	updateSQL := `UPDATE SESSIONS SET  KNOWLEDGE_BASES=?, HISTORY=? WHERE ID=?`

	kbBytes, err := json.Marshal(session.KnowledgeBases)
	if err != nil {
		return err
	}

	historyBytes, err := json.Marshal(session.History)
	if err != nil {
		return err
	}

	_, err = s.client.ExecContext(ctx, updateSQL, string(kbBytes), string(historyBytes), session.Id)
	if err != nil {
		return err
	}

	return nil
}

func (s *SQLite) GetKBIdFromFriendlyName(friendlyName string) (int, error) {

	getSQL := `SELECT ID FROM kb WHERE friendly_name=?`

	var id int
	err := s.client.QueryRow(getSQL, friendlyName).Scan(&id)
	if err != nil {
		return -1, err
	}

	return id, nil
}

// Queued -> Indexing -> Completed / Error

func (s *SQLite) UpdateArticleIndexingStatus(articleId int, name string, status string, message string) error {
	getSQL := `SELECT ID FROM article_indexing_statuses WHERE name = ? AND article_id = ?`

	var id int
	err := s.client.QueryRow(getSQL, name, articleId).Scan(&id)
	if err == sql.ErrNoRows {
		insertSQL := `INSERT INTO article_indexing_statuses (article_id, name, status, message) VALUES (?, ?, ?, ?)`
		_, err = s.client.Exec(insertSQL, articleId, name, status, message)
		if err != nil {
			return err
		}
	} else if err != nil {
		return err
	} else {
		updateSQL := `UPDATE article_indexing_statuses SET status = ?, message = ? WHERE ID = ?`
		_, err = s.client.Exec(updateSQL, status, message, id)
		if err != nil {
			return err
		}
	}

	// If all statuses have been updated then update article record
	// If any status is Error then set article status to "Completed with Errors"
	// If all statuses are Completed then set article status to "Completed"
	// If all statuses are Indexing then set article status to "Indexing"
	// else Queued

	tx, err := s.client.BeginTx(context.Background(), &sql.TxOptions{})
	if err != nil {
		return err
	}

	checkStatusStmtForArticleID := `SELECT STATUS FROM article_indexing_statuses WHERE ARTICLE_ID=?`
	rows, err := tx.Query(checkStatusStmtForArticleID, articleId)
	if err != nil {
		tx.Rollback()
		return err
	}

	statuses := make(map[string]struct{})
	var indexingStatus string
	for rows.Next() {
		err = rows.Scan(&indexingStatus)
		if err != nil {
			tx.Rollback()
			return err
		}

		statuses[indexingStatus] = struct{}{}
	}

	articleIndexStatus := ""
	if _, exists := statuses["Errored"]; exists {
		articleIndexStatus = "Completed with error"
	} else if _, exists := statuses["Completed"]; len(statuses) == 1 && exists {
		articleIndexStatus = "Completed"
	} else if _, exists := statuses["Indexing"]; len(statuses) == 1 && exists {
		articleIndexStatus = "Indexing"
	} else {
		articleIndexStatus = "Queued"
	}

	updateArticleStatus := `UPDATE articles SET status = ? WHERE ID = ?`
	_, err = tx.Exec(updateArticleStatus, articleIndexStatus, articleId)
	if err != nil {
		tx.Rollback()
		return err
	}

	tx.Commit()
	return nil
}

// GetKnowledgeBases() ([]models.KnowledgeBase, error)
func (s *SQLite) GetKnowledgeBases(friendlyNames []string) ([]*models.KnowledgeBase, error) {
	var getSQL string
	var bindVariables []any

	if len(friendlyNames) == 0 {
		getSQL = `SELECT ID,NAME, DESCRIPTION, FRIENDLY_NAME FROM kb`
	} else {
		placeholders := make([]string, len(friendlyNames))
		args := make([]any, len(friendlyNames))
		for i, name := range friendlyNames {
			placeholders[i] = "?"
			args[i] = name
		}
		getSQL = fmt.Sprintf(`SELECT ID,NAME, DESCRIPTION, FRIENDLY_NAME FROM kb WHERE FRIENDLY_NAME IN (%s)`, strings.Join(placeholders, ", "))
		bindVariables = append(bindVariables, args...)
	}

	rows, err := s.client.Query(getSQL, bindVariables...)
	if err != nil {
		return nil, err
	}

	var knowledgeBases []*models.KnowledgeBase
	for rows.Next() {
		kb := models.KnowledgeBase{}
		err = rows.Scan(&kb.Id, &kb.Name, &kb.Description, &kb.FriendlyName)
		if err != nil {
			return nil, err
		}

		getArticles := `SELECT ID,NAME FROM articles WHERE KB_ID=?`
		articles, err := s.client.Query(getArticles, &kb.Id)
		if err != nil {
			return nil, err
		}

		at := []models.Article{}
		for articles.Next() {
			a := models.Article{}
			err = articles.Scan(&a.Id, &a.Name)
			if err != nil {
				return nil, err
			}

			getArticleIndexingSQL := `SELECT name, status, message FROM article_indexing_statuses WHERE article_id = ?`
			is, err := s.client.Query(getArticleIndexingSQL, &a.Id)
			if err != nil {
				return nil, err
			}

			for is.Next() {
				indexingStatus := models.ArticleIndexingStatus{}
				err = is.Scan(&indexingStatus.Name, &indexingStatus.Status, &indexingStatus.Message)
				if err != nil {
					return nil, err
				}

				a.ArticleIndexing = append(a.ArticleIndexing, indexingStatus)
			}

			at = append(at, a)
		}

		kb.Articles = at

		knowledgeBases = append(knowledgeBases, &kb)

	}

	return knowledgeBases, nil
}
