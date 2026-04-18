package utils

import (
	"time"

	"github.com/forscht/namegen"
	"github.com/forscht/namegen/dictionaries"
)

func GenerateName() string {
	// Generate a new name
	name := namegen.New().
		WithNumberOfWords(2).
		WithWordSeparator("-").
		WithStyle(namegen.Lowercase).
		WithDictionaries(dictionaries.Adjectives, dictionaries.Animals).
		WithSeed(time.Now().UnixNano()).
		Generate()

	return name
}
