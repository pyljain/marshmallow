package config

import (
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Stores  []Store `yaml:"stores"`
	Queue   Queue   `yaml:"queue"`
	Storage Storage `yaml:"storage"`
}

type Store struct {
	Name          string `yaml:"name"`
	IndexingQueue string `yaml:"indexingQueue"`
	StatusQueue   string `yaml:"statusQueue"`
	EndPoint      string `yaml:"endPoint"`
}

type Queue struct {
	Type             string `yaml:"type"`
	ConnectionString string `yaml:"connectionString"`
}

type Storage struct {
	Type             string `yaml:"type"`
	ConnectionString string `yaml:"connectionString"`
}

func LoadConfig(path string) (*Config, error) {
	fileBytes, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var c Config
	err = yaml.Unmarshal(fileBytes, &c)
	if err != nil {
		return nil, err
	}

	return &c, nil
}
