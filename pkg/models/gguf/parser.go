package gguf

import (
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

// GGUF Types
const (
	GGUF_TYPE_UINT8   = 0
	GGUF_TYPE_INT8    = 1
	GGUF_TYPE_UINT16  = 2
	GGUF_TYPE_INT16   = 3
	GGUF_TYPE_UINT32  = 4
	GGUF_TYPE_INT32   = 5
	GGUF_TYPE_FLOAT32 = 6
	GGUF_TYPE_BOOL    = 7
	GGUF_TYPE_STRING  = 8
	GGUF_TYPE_ARRAY   = 9
	GGUF_TYPE_UINT64  = 10
	GGUF_TYPE_INT64   = 11
	GGUF_TYPE_FLOAT64 = 12
)

// GGUF Magic and Version
var (
	GGUF_MAGIC   = [4]byte{'G', 'G', 'U', 'F'}
	GGUF_VERSION = 3
)

// GGUFValue represents a value in GGUF metadata
type GGUFValue struct {
	Type  int
	Value interface{}
}

// GGUFMetadata holds the parsed GGUF metadata
type GGUFMetadata struct {
	// General info
	Architecture string // general.architecture
	Name         string // general.name
	FileType     string // general.file_type (quantization)
	Author       string // general.author
	Description  string // general.description
	Version      string // general.version

	// Tokenizer
	TokenizerModel string // tokenizer.ggml.model

	// Model specs (varies by architecture, use dynamic keys)
	VocabularySize   int64 // {arch}.vocab_size
	ContextLength    int64 // {arch}.context_length
	EmbeddingLength  int64 // {arch}.embedding_length
	BlockCount       int64 // {arch}.block_count
	AttentionHeads   int64 // {arch}.attention.head_count
	AttentionKVHeads int64 // {arch}.attention.head_count_kv
	ExpertCount      int64 // {arch}.expert_count
	ExpertUsedCount  int64 // {arch}.expert_used_count

	// Quantization
	QuantizationVersion int64 // general.quantization_version

	// Raw metadata
	Raw map[string]GGUFValue

	// Alignment
	Alignment uint32
}

// Reader GGUF file reader
type Reader struct {
	file    *os.File
	meta    *GGUFMetadata
	tensorCount int64
	kvCount     int64
	dataOffset  int64
}

// NewReader creates a new GGUF reader
func NewReader(path string) (*Reader, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}

	r := &Reader{
		file: file,
		meta: &GGUFMetadata{
			Raw: make(map[string]GGUFValue),
		},
	}

	if err := r.readHeader(); err != nil {
		file.Close()
		return nil, fmt.Errorf("failed to read header: %w", err)
	}

	if err := r.readKVpairs(); err != nil {
		file.Close()
		return nil, fmt.Errorf("failed to read KV pairs: %w", err)
	}

	return r, nil
}

// Close closes the GGUF file
func (r *Reader) Close() error {
	return r.file.Close()
}

// Metadata returns the parsed metadata
func (r *Reader) Metadata() *GGUFMetadata {
	return r.meta
}

// GetString returns a string value by key
func (r *Reader) GetString(key string) string {
	if v, ok := r.meta.Raw[key]; ok {
		if s, ok := v.Value.(string); ok {
			return s
		}
	}
	return ""
}

// GetInt64 returns an int64 value by key
func (r *Reader) GetInt64(key string) int64 {
	if v, ok := r.meta.Raw[key]; ok {
		switch val := v.Value.(type) {
		case int64:
			return val
		case int32:
			return int64(val)
		case int16:
			return int64(val)
		case int8:
			return int64(val)
		case uint64:
			return int64(val)
		case uint32:
			return int64(val)
		}
	}
	return 0
}

func (r *Reader) readHeader() error {
	// Read magic (4 bytes)
	magic := make([]byte, 4)
	if _, err := io.ReadFull(r.file, magic); err != nil {
		return err
	}

	if string(magic) != string(GGUF_MAGIC[:]) {
		return errors.New("invalid GGUF magic")
	}

	// Read version (4 bytes)
	version := make([]byte, 4)
	if _, err := io.ReadFull(r.file, version); err != nil {
		return err
	}
	r.meta.Alignment = 32 // default

	// Read tensor count (8 bytes)
	if err := binary.Read(r.file, binary.LittleEndian, &r.tensorCount); err != nil {
		return err
	}

	// Read KV count (8 bytes)
	if err := binary.Read(r.file, binary.LittleEndian, &r.kvCount); err != nil {
		return err
	}

	return nil
}

func (r *Reader) readKVpairs() error {
	// First pass: read all KV pairs
	for i := int64(0); i < r.kvCount; i++ {
		// Read key
		key, err := r.readString()
		if err != nil {
			return fmt.Errorf("failed to read key %d: %w", i, err)
		}

		// Read type
		var kvType uint32
		if err := binary.Read(r.file, binary.LittleEndian, &kvType); err != nil {
			return fmt.Errorf("failed to read type for key %s: %w", key, err)
		}

		// Read value
		value, err := r.readValue(int(kvType))
		if err != nil {
			return fmt.Errorf("failed to read value for key %s: %w", key, err)
		}

		r.meta.Raw[key] = GGUFValue{
			Type:  int(kvType),
			Value: value,
		}
	}

	// Second pass: extract common fields (after all KV pairs are read)
	for key, gguv := range r.meta.Raw {
		r.extractCommonFields(key, gguv.Value)
	}

	return nil
}

func (r *Reader) extractCommonFields(key string, value interface{}) {
	// Helper to set int64 from various int types
	setInt64 := func(target *int64) {
		switch v := value.(type) {
		case int64:
			*target = v
		case int32:
			*target = int64(v)
		case int16:
			*target = int64(v)
		case int8:
			*target = int64(v)
		case uint64:
			*target = int64(v)
		case uint32:
			*target = int64(v)
		}
	}

	switch key {
	case "general.architecture":
		if s, ok := value.(string); ok {
			r.meta.Architecture = s
		}
	case "general.name":
		if s, ok := value.(string); ok {
			r.meta.Name = s
		}
	case "general.file_type":
		if s, ok := value.(string); ok {
			r.meta.FileType = s
		} else if v, ok := value.(int64); ok {
			r.meta.FileType = GetQuantizationName(int(v))
		} else if v, ok := value.(int32); ok {
			r.meta.FileType = GetQuantizationName(int(v))
		} else if v, ok := value.(uint32); ok {
			r.meta.FileType = GetQuantizationName(int(v))
		} else if v, ok := value.(uint64); ok {
			r.meta.FileType = GetQuantizationName(int(v))
		}
	case "general.author":
		if s, ok := value.(string); ok {
			r.meta.Author = s
		}
	case "general.description":
		if s, ok := value.(string); ok {
			r.meta.Description = s
		}
	case "general.version":
		if s, ok := value.(string); ok {
			r.meta.Version = s
		}
	case "general.alignment":
		if v, ok := value.(uint32); ok {
			r.meta.Alignment = v
		}
	case "general.quantization_version":
		setInt64(&r.meta.QuantizationVersion)
	case "tokenizer.ggml.model":
		if s, ok := value.(string); ok {
			r.meta.TokenizerModel = s
		}
	default:
		// Check for common keys (without architecture prefix)
		switch {
		case strings.HasSuffix(key, ".vocab_size"):
			setInt64(&r.meta.VocabularySize)
		case strings.HasSuffix(key, ".context_length"):
			setInt64(&r.meta.ContextLength)
		case strings.HasSuffix(key, ".embedding_length"):
			setInt64(&r.meta.EmbeddingLength)
		case strings.HasSuffix(key, ".block_count"):
			setInt64(&r.meta.BlockCount)
		case strings.HasSuffix(key, ".attention.head_count"):
			setInt64(&r.meta.AttentionHeads)
		case strings.HasSuffix(key, ".attention.head_count_kv"):
			setInt64(&r.meta.AttentionKVHeads)
		case strings.HasSuffix(key, ".expert_count"):
			setInt64(&r.meta.ExpertCount)
		case strings.HasSuffix(key, ".expert_used_count"):
			setInt64(&r.meta.ExpertUsedCount)
		}
	}
}

func (r *Reader) readValue(kvType int) (interface{}, error) {
	switch kvType {
	case GGUF_TYPE_UINT8:
		var v uint8
		if err := binary.Read(r.file, binary.LittleEndian, &v); err != nil {
			return nil, err
		}
		return v, nil
	case GGUF_TYPE_INT8:
		var v int8
		if err := binary.Read(r.file, binary.LittleEndian, &v); err != nil {
			return nil, err
		}
		return v, nil
	case GGUF_TYPE_UINT16:
		var v uint16
		if err := binary.Read(r.file, binary.LittleEndian, &v); err != nil {
			return nil, err
		}
		return v, nil
	case GGUF_TYPE_INT16:
		var v int16
		if err := binary.Read(r.file, binary.LittleEndian, &v); err != nil {
			return nil, err
		}
		return v, nil
	case GGUF_TYPE_UINT32:
		var v uint32
		if err := binary.Read(r.file, binary.LittleEndian, &v); err != nil {
			return nil, err
		}
		return v, nil
	case GGUF_TYPE_INT32:
		var v int32
		if err := binary.Read(r.file, binary.LittleEndian, &v); err != nil {
			return nil, err
		}
		return v, nil
	case GGUF_TYPE_FLOAT32:
		var v float32
		if err := binary.Read(r.file, binary.LittleEndian, &v); err != nil {
			return nil, err
		}
		return v, nil
	case GGUF_TYPE_UINT64:
		var v uint64
		if err := binary.Read(r.file, binary.LittleEndian, &v); err != nil {
			return nil, err
		}
		return v, nil
	case GGUF_TYPE_INT64:
		var v int64
		if err := binary.Read(r.file, binary.LittleEndian, &v); err != nil {
			return nil, err
		}
		return v, nil
	case GGUF_TYPE_FLOAT64:
		var v float64
		if err := binary.Read(r.file, binary.LittleEndian, &v); err != nil {
			return nil, err
		}
		return v, nil
	case GGUF_TYPE_BOOL:
		var v int8
		if err := binary.Read(r.file, binary.LittleEndian, &v); err != nil {
			return nil, err
		}
		return v != 0, nil
	case GGUF_TYPE_STRING:
		return r.readString()
	case GGUF_TYPE_ARRAY:
		return r.readArray()
	default:
		return nil, fmt.Errorf("unknown GGUF type: %d", kvType)
	}
}

func (r *Reader) readString() (string, error) {
	var length uint64
	if err := binary.Read(r.file, binary.LittleEndian, &length); err != nil {
		return "", err
	}

	// Limit string length to prevent memory issues
	// Also check for obviously wrong values (e.g., huge numbers that might indicate
	// we're reading the wrong position in the file)
	if length > 10*1024*1024 {
		// Skip this string - likely reading wrong position
		// Try to recover by seeking forward
		r.file.Seek(int64(length), io.SeekCurrent)
		return "", fmt.Errorf("string too long, skipping: %d", length)
	}

	buf := make([]byte, length)
	if _, err := io.ReadFull(r.file, buf); err != nil {
		return "", err
	}

	return string(buf), nil
}

func (r *Reader) readArray() (interface{}, error) {
	// Read array type
	var arrType uint32
	if err := binary.Read(r.file, binary.LittleEndian, &arrType); err != nil {
		return nil, err
	}

	// Read array length
	var length uint64
	if err := binary.Read(r.file, binary.LittleEndian, &length); err != nil {
		return nil, err
	}

	// Limit array length - for token arrays this can be huge
	// Just skip the entire array for now
	if length > 10000 {
		// Skip based on type
		bytesToSkip := int64(0)
		switch arrType {
		case GGUF_TYPE_STRING:
			// For string arrays, we need to read each string length + string
			for i := uint64(0); i < length; i++ {
				var slen uint64
				if err := binary.Read(r.file, binary.LittleEndian, &slen); err != nil {
					return nil, err
				}
				r.file.Seek(int64(slen), io.SeekCurrent)
			}
			return nil, nil
		case GGUF_TYPE_INT32, GGUF_TYPE_UINT32:
			bytesToSkip = int64(length) * 4
		case GGUF_TYPE_INT64, GGUF_TYPE_UINT64:
			bytesToSkip = int64(length) * 8
		case GGUF_TYPE_FLOAT32:
			bytesToSkip = int64(length) * 4
		case GGUF_TYPE_FLOAT64:
			bytesToSkip = int64(length) * 8
		default:
			bytesToSkip = int64(length) * 8
		}
		r.file.Seek(bytesToSkip, io.SeekCurrent)
		return nil, nil
	}

	// For smaller arrays, read the values
	switch arrType {
	case GGUF_TYPE_STRING:
		var strings []string
		for i := uint64(0); i < length; i++ {
			s, err := r.readString()
			if err != nil {
				return nil, err
			}
			strings = append(strings, s)
		}
		return strings, nil
	case GGUF_TYPE_INT32:
		var vals []int32
		for i := uint64(0); i < length; i++ {
			var v int32
			binary.Read(r.file, binary.LittleEndian, &v)
			vals = append(vals, v)
		}
		return vals, nil
	case GGUF_TYPE_UINT32:
		var vals []uint32
		for i := uint64(0); i < length; i++ {
			var v uint32
			binary.Read(r.file, binary.LittleEndian, &v)
			vals = append(vals, v)
		}
		return vals, nil
	default:
		// Skip remaining bytes
		r.file.Seek(0, io.SeekCurrent) // placeholder
		return nil, nil
	}
}

// GetModelInfo extracts model info from a GGUF file
func GetModelInfo(path string) (*GGUFMetadata, error) {
	reader, err := NewReader(path)
	if err != nil {
		return nil, err
	}
	defer reader.Close()

	return reader.Metadata(), nil
}

// GetQuantizationName returns the quantization name from integer type
func GetQuantizationName(t int) string {
	names := map[int]string{
		0:  "F32",
		1:  "F16",
		2:  "Q4_0",
		3:  "Q4_1",
		7:  "Q8_0",
		8:  "Q5_0",
		9:  "Q5_1",
		10: "Q2_K",
		11: "Q3_K_S",
		12: "Q3_K_M",
		13: "Q3_K_L",
		14: "Q4_K_S",
		15: "Q4_K_M",
		16: "Q5_K_S",
		17: "Q5_K_M",
		18: "Q6_K",
		19: "IQ2_XXS",
		20: "IQ2_XS",
		21: "Q2_K_S",
		22: "IQ3_XS",
		23: "IQ3_XXS",
		24: "IQ1_S",
		25: "IQ4_NL",
		26: "IQ3_S",
		27: "IQ3_M",
		28: "IQ2_S",
		29: "IQ2_M",
		30: "IQ4_XS",
		31: "IQ1_M",
		32: "BF16",
		36: "TQ1_0",
		37: "TQ2_0",
		38: "TQ2_0",
		39: "MXFP4",
		40: "NVFP4",
	}
	if name, ok := names[t]; ok {
		return name
	}
	return fmt.Sprintf("Unknown(%d)", t)
}

// FormatQuantization converts quantization string to a display-friendly format
func FormatQuantization(q string) string {
	if q == "" {
		return "Unknown"
	}

	// Remove common prefixes
	q = strings.TrimPrefix(q, "Q")
	q = strings.TrimPrefix(q, "q")

	// Format: 2_0 -> 2.0, 3_1 -> 3.1
	q = strings.ReplaceAll(q, "_", ".")

	return "Q" + q
}
