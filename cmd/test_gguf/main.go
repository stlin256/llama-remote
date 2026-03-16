package main

import (
	"fmt"
	"strings"

	"github.com/llama-remote/server/pkg/models/gguf"
)

func main() {
	// Test with a vocab file
	path := "C:/Users/B450M/Documents/llama.cpp/models/ggml-vocab-qwen2.gguf"

	meta, err := gguf.GetModelInfo(path)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}

	fmt.Printf("=== GGUF Model Info ===\n")
	fmt.Printf("Name:         %s\n", meta.Name)
	fmt.Printf("Architecture: %s\n", meta.Architecture)
	fmt.Printf("FileType:     %s\n", meta.FileType)
	fmt.Printf("Tokenizer:    %s\n", meta.TokenizerModel)
	fmt.Printf("Vocab Size:   %d\n", meta.VocabularySize)
	fmt.Printf("Context:      %d\n", meta.ContextLength)
	fmt.Printf("Embedding:    %d\n", meta.EmbeddingLength)
	fmt.Printf("Block Count:  %d\n", meta.BlockCount)
	fmt.Printf("Attention:    %d heads\n", meta.AttentionHeads)

	// Print all keys containing "vocab"
	fmt.Printf("\n=== Keys containing 'vocab' ===\n")
	for k, v := range meta.Raw {
		if strings.Contains(strings.ToLower(k), "vocab") {
			fmt.Printf("%s: %v (type: %d)\n", k, v.Value, v.Type)
		}
	}

	// Print all keys
	fmt.Printf("\n=== All Keys ===\n")
	for k, v := range meta.Raw {
		fmt.Printf("%s: %v (type: %d)\n", k, v.Value, v.Type)
	}
}
