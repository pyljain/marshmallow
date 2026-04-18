package utils

import (
	"io"
	"log"
	"os"

	"github.com/ledongthuc/pdf"
)

func ExtractPDFContent(filebytes []byte) (string, error) {
	tmpDir := os.TempDir()
	f, err := os.CreateTemp(tmpDir, "marsh-*")
	if err != nil {
		return "", err
	}

	_, err = f.Write(filebytes)
	if err != nil {
		return "", err
	}

	f.Close()

	fh, r, err := pdf.Open(f.Name())
	if err != nil {
		return "", err
	}

	defer fh.Close()

	log.Printf("Reading file content to GetPlainText")
	reader, err := r.GetPlainText()
	if err != nil {
		return "", err
	}

	log.Printf("Reading content io.ReadAll(reader)")
	content, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}

	log.Printf("Content read is %s", string(content))
	return string(content), nil

}
