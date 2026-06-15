package main

import (
	"fmt"
	"io"
	"os"

	"github.com/XXY-CH/Aetherion/packages/tui-go/setupapp"
)

func main() {
	input, err := openConfigInput(os.Args[1:], os.Stdin)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ether setup tui: %v\n", err)
		os.Exit(1)
	}
	if input.close != nil {
		defer input.close()
	}

	cfg, err := setupapp.DecodeConfig(input.reader)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ether setup tui: %v\n", err)
		os.Exit(1)
	}
	if err := setupapp.Run(cfg, os.Stdout); err != nil {
		fmt.Fprintf(os.Stderr, "ether setup tui: %v\n", err)
		os.Exit(1)
	}
}

type configInput struct {
	reader io.Reader
	close  func() error
}

func openConfigInput(args []string, stdin io.Reader) (configInput, error) {
	if len(args) == 0 {
		return configInput{reader: stdin}, nil
	}
	file, err := os.Open(args[0])
	if err != nil {
		return configInput{}, fmt.Errorf("open config: %w", err)
	}
	return configInput{reader: file, close: file.Close}, nil
}
