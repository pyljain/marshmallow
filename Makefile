build-km:
	go build -o ./bin/km ./cmd/knowledgemanager/main.go

run-km: build-km
	./bin/km --config ./samples/config.yaml

run-lancedb-service:
	uv run lancedb-service --api_port=9001

build-bleve-service:
	go build -o ./bin/bleve ./cmd/stores/bleve/main.go

run-bleve-service: build-bleve-service
	./bin/bleve